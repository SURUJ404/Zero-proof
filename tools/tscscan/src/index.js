const EventEmitter = require('events').EventEmitter;
const TcpScan = require('./libs/TcpScan');
const dns = require('dns');
const async = require('async');

class Evtscan extends EventEmitter {

    constructor(opts) {
        super();

        this.lastMessage = 'Starting';
        this.paused = false;
        this.progress = 0;
        this.progressTimer = null;
        this.resultCount = 0;

        this.options = {
            target: opts.target || '127.0.0.1',
            port: opts.port || '1-1000',
            timeout: opts.timeout || 2000,
            concurrency: opts.concurrency || 100,
            banner: opts.banner || false,
            bannerlen: opts.bannerlen || 512,
            reverse: opts.reverse || false,
            progress: opts.progress || false,
            json: opts.json || false
        };

        this.ips = [];
        this.ports = [];
        this.totalJobs = 0;
        this.completedJobs = 0;
        this.running = false;
        this.aborted = false;
        this.cacheDns = {};
    }

    _parseTargets(target) {
        const ips = [];
        const parts = target.split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('/')) {
                const cidrIps = this._parseCIDR(trimmed);
                ips.push(...cidrIps);
            } else if (trimmed.includes('-')) {
                const rangeIps = this._parseRange(trimmed);
                ips.push(...rangeIps);
            } else {
                ips.push(trimmed);
            }
        }
        return ips;
    }

    _parseCIDR(cidr) {
        const ips = [];
        const [base, prefixStr] = cidr.split('/');
        const prefix = parseInt(prefixStr);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) return [cidr];

        const ipLong = this._ip2long(base);
        if (ipLong === null) return [cidr];

        const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const network = (ipLong & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;

        for (let host = network + 1; host < broadcast; host++)
            ips.push(this._long2ip(host));

        return ips;
    }

    _parseRange(range) {
        const ips = [];
        const [start, end] = range.split('-');

        if (end.includes('.')) {
            const startLong = this._ip2long(start);
            const endLong = this._ip2long(end);
            if (startLong === null || endLong === null) return [range];
            for (let i = startLong; i <= endLong; i++)
                ips.push(this._long2ip(i));
        } else {
            const lastDot = start.lastIndexOf('.');
            const base = start.substring(0, lastDot + 1);
            const startOct = parseInt(start.substring(lastDot + 1));
            const endOct = parseInt(end);
            for (let i = startOct; i <= endOct; i++)
                ips.push(base + i);
        }
        return ips;
    }

    _parsePorts(portStr) {
        const ports = [];
        const parts = String(portStr).split(',');

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [s, e] = trimmed.split('-');
                const start = parseInt(s);
                const end = parseInt(e);
                for (let p = start; p <= end; p++)
                    ports.push(p);
            } else {
                ports.push(parseInt(trimmed));
            }
        }
        return ports;
    }

    _ip2long(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return null;
        let result = 0;
        for (const part of parts) {
            const oct = parseInt(part);
            if (isNaN(oct) || oct < 0 || oct > 255) return null;
            result = (result << 8) + oct;
        }
        return result >>> 0;
    }

    _long2ip(long) {
        return [
            (long >>> 24) & 0xFF,
            (long >>> 16) & 0xFF,
            (long >>> 8) & 0xFF,
            long & 0xFF
        ].join('.');
    }

    _reverseDns(ip, callback) {
        if (!this.options.reverse) return callback();

        if (this.cacheDns[ip]) return callback(null, this.cacheDns[ip]);

        dns.reverse(ip, (err, domains) => {
            if (err || !domains || !domains.length) return callback();
            this.cacheDns[ip] = domains[0];
            callback(null, domains[0]);
        });
    }

    _portScan(ip, port, callback) {
        if (!port) return callback();

        const t = new TcpScan({
            ip,
            port,
            banner: this.options.banner,
            bannerlen: this.options.bannerlen,
            timeout: this.options.timeout
        });

        t.analyzePort((err, result) => {
            callback(err, result);
        });
    }

    _processJob(args, callback) {
        const self = this;
        let result = { ip: args.ip, port: args.port };

        this.lastMessage = `Scanning ${args.ip}${args.port ? ':' + args.port : ''}`;

        async.series([
            (next) => {
                self._reverseDns(args.ip, next);
            },
            (next) => {
                self._portScan(args.ip, args.port, next);
            }
        ], (err, arr) => {
            const dnsResult = arr[0];
            const scanResult = arr[1];

            if (scanResult && scanResult.status === 'open') {
                result.status = 'open';
                result.banner = scanResult.banner || '';
            } else if (scanResult && scanResult.status) {
                result.status = scanResult.status;
            } else {
                result.status = 'closed';
            }

            if (dnsResult) result.reverse = dnsResult;

            self.completedJobs++;

            const progress = self.totalJobs > 0 ? Math.floor((self.completedJobs / self.totalJobs) * 100) : 0;

            self.emit('progress', {
                _timeElapsed: 0,
                _jobsTotal: self.totalJobs,
                _jobsDone: self.completedJobs,
                _progress: progress,
                _concurrency: self.options.concurrency,
                _status: 'Running',
                _message: self.lastMessage
            });

            self.emit('result', result);
            self.resultCount++;

            callback();
        });
    }

    run(callback) {
        this.ips = this._parseTargets(this.options.target);
        this.ports = this._parsePorts(this.options.port);
        this.totalJobs = this.ips.length * this.ports.length;
        this.completedJobs = 0;
        this.running = true;
        this.aborted = false;

        if (this.totalJobs === 0) {
            this.emit('done');
            if (callback) callback();
            return;
        }

        const self = this;
        const queue = [];
        for (const ip of this.ips) {
            for (const port of this.ports) {
                queue.push({ ip, port });
            }
        }

        let index = 0;
        let active = 0;
        let done = false;

        function next() {
            if (self.aborted) {
                if (active === 0 && !done) {
                    done = true;
                    self.running = false;
                    self.emit('done');
                    if (callback) callback();
                }
                return;
            }

            if (index >= queue.length) {
                if (active === 0 && !done) {
                    done = true;
                    self.running = false;
                    self.emit('done');
                    if (callback) callback();
                }
                return;
            }

            while (active < self.options.concurrency && index < queue.length) {
                const job = queue[index++];
                active++;

                self._processJob(job, () => {
                    active--;
                    next();
                });
            }
        }

        next();
    }

    getResultCount() {
        return this.resultCount;
    }

    pause() {
        this.paused = true;
    }

    unpause() {
        this.paused = false;
    }

    abort() {
        this.aborted = true;
    }
}

module.exports = Evtscan;
