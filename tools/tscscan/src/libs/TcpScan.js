const net = require('net');

class TcpScan {

    constructor(opts) {
        this.opts = opts;
        this.opts.bannerlen = opts.bannerlen || 512;
        this.opts.timeout = opts.timeout || 2000;

        this.result = {
            ip: opts.ip,
            port: opts.port,
            banner: '',
            status: null,
            opened: false
        };

        this.socket = null;
        this.bufArray = [];
        this.finished = false;
    }

    formatBanner(str) {
        str = str.replace(/\n/gm, '\\n');
        str = str.replace(/\r/gm, '\\r');
        str = str.replace(/\t/gm, '\\t');
        str = str.replace(/ *$/, '');
        str = str.replace(/^ */, '');
        str = str.substr(0, this.opts.bannerlen);
        return str;
    }

    _sendResult(timeouted) {
        if (this.bufArray.length) {
            this.result.raw = Buffer.concat(this.bufArray);
        }

        if (this.result.banner) {
            this.result.banner = this.formatBanner(this.result.banner);
        }

        if (!this.result.status) {
            if (!this.result.opened) {
                this.result.status = timeouted ? 'timeout' : 'closed';
            } else {
                this.result.status = 'open';
            }
        }

        if (this.socket) {
            try { this.socket.destroy(); } catch(e) {}
            delete this.socket;
        }
        if (!this.finished) {
            this.finished = true;
            this.cb(null, this.result);
        }
    }

    _onClose() {
        if (this.finished) return;
        if (!this.result.banner && !this.result.opened) {
            this.result.opened = false;
        }
        if (!this.result.status) {
            this.result.status = 'closed';
        }
        this._sendResult();
    }

    _onError(e) {
        if (e.message && e.message.match(/ECONNREFUSED/)) {
            this.result.status = 'refused';
            return;
        }
        if (e.message && e.message.match(/EHOSTUNREACH|ENETUNREACH/)) {
            this.result.status = 'unreachable';
            return;
        }
        if (e.message && e.message.match(/ETIMEDOUT/)) {
            this.result.status = 'timeout';
            return;
        }
        this.result.status = 'closed';
    }

    _onConnect() {
        this.result.opened = true;
    }

    _onTimeout() {
        if (!this.result.opened) {
            this.result.status = 'timeout';
        } else {
            this.result.status = 'open';
        }
        if (this.socket) this.socket.destroy();
    }

    _onData(buf) {
        this.bufArray.push(buf);
        if (this.result.banner.length < this.opts.bannerlen) {
            const d = buf.toString('ascii');
            this.result.banner += d;
        }
        if (this.result.banner.length >= this.opts.bannerlen) {
            if (this.socket) this.socket.destroy();
        }
    }

    analyzePort(callback) {
        this.cb = callback;

        this.socket = net.createConnection(this.opts.port, this.opts.ip);
        this.socket.removeAllListeners('timeout');
        this.socket.setTimeout(this.opts.timeout);

        this.socket.on('close', this._onClose.bind(this));
        this.socket.on('error', this._onError.bind(this));
        this.socket.on('connect', this._onConnect.bind(this));
        this.socket.on('timeout', this._onTimeout.bind(this));
        this.socket.on('data', this._onData.bind(this));
    }
}

module.exports = TcpScan;
