'use strict';

const dgram = require('dgram');
const crypto = require('crypto');
const KBucket = require('./kbucket');
const DHT = require('./dht');
const Gossip = require('./gossip');
const Protocol = require('./protocol');

class Node {
  constructor(options = {}) {
    this.identity = options.identity || `node-${crypto.randomBytes(4).toString('hex')}`;
    this.port = options.port || 0;
    this.k = options.k || 20;
    this.alpha = options.alpha || 3;

    this.nodeId = crypto.createHash('sha1').update(this.identity).digest();
    this.routingTable = new KBucket(this.nodeId, this.k);
    this.dht = new DHT(this);
    this.gossip = new Gossip(this);
    this.socket = dgram.createSocket('udp4');
    this.pendingRequests = new Map();
    this.running = false;

    this._onMessage = this._onMessage.bind(this);
    this._refreshTimer = null;
  }

  async start() {
    return new Promise((resolve) => {
      this.socket.on('message', this._onMessage);
      this.socket.bind(this.port, '0.0.0.0', () => {
        this.port = this.socket.address().port;
        this.running = true;
        this.dht.start();
        this.gossip.start();
        this._refreshTimer = setInterval(() => this._refresh(), 60000);
        resolve();
      });
    });
  }

  async stop() {
    this.running = false;
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    this.dht.stop();
    this.gossip.stop();
    this.socket.close();
  }

  async join(bootstrapNodes) {
    for (const addr of bootstrapNodes) {
      const [host, portStr] = addr.split(':');
      const port = parseInt(portStr, 10);
      if (isNaN(port)) continue;
      try {
        const resp = await this._sendRPC(host, port, 'FIND_NODE', {
          targetId: this.nodeId.toString('hex')
        });
        if (resp.type === 'FOUND_NODES' && resp.payload.nodes) {
          for (const n of resp.payload.nodes) {
            const nId = Buffer.from(n.nodeId, 'hex');
            this.routingTable.update(nId, n.address, n.port);
          }
        }
      } catch (e) {
      }
    }
  }

  async findNode(targetId) {
    const targetBuf = Buffer.from(targetId, 'hex');
    const queried = new Set();
    let closest = this.routingTable.getClosest(targetBuf, this.alpha);

    while (closest.length > 0) {
      for (const entry of closest) {
        const addr = `${entry.address}:${entry.port}`;
        if (queried.has(addr)) continue;
        queried.add(addr);

        try {
          const resp = await this._sendRPC(entry.address, entry.port, 'FIND_NODE', {
            targetId
          });
          if (resp.type === 'FOUND_NODES' && resp.payload.nodes) {
            for (const n of resp.payload.nodes) {
              const nId = Buffer.from(n.nodeId, 'hex');
              this.routingTable.update(nId, n.address, n.port);
            }
          }
        } catch (e) {
        }
      }

      closest = this.routingTable.getClosest(targetBuf, this.alpha)
        .filter(e => !queried.has(`${e.address}:${e.port}`));

      if (queried.size > 20) break;
    }

    return this.routingTable.getClosest(targetBuf, this.k);
  }

  async store(key, value) {
    return this.dht.store(key, value);
  }

  async findValue(key) {
    return this.dht.findValue(key);
  }

  async gossip(key, value, ttl = 5) {
    return this.gossip.broadcast(key, value, ttl);
  }

  _sendRPC(host, port, type, payload, ttl = 5) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomBytes(4).readUInt32BE(0);
      const msg = {
        type,
        senderId: this.nodeId.toString('hex'),
        requestId,
        ttl,
        payload: payload || {}
      };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`RPC timeout: ${type} to ${host}:${port}`));
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      try {
        const data = Protocol.encode(msg);
        this.socket.send(data, 0, data.length, port, host, (err) => {
          if (err) {
            clearTimeout(timer);
            this.pendingRequests.delete(requestId);
            reject(err);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(e);
      }
    });
  }

  _sendRaw(host, port, msg) {
    return new Promise((resolve, reject) => {
      try {
        const data = Protocol.encode(msg);
        this.socket.send(data, 0, data.length, port, host, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  _onMessage(buf, rinfo) {
    try {
      const msg = Protocol.decode(buf);
      const senderId = Buffer.from(msg.senderId, 'hex');

      this.routingTable.update(senderId, rinfo.address, rinfo.port);

      if (Protocol.isResponse(msg.type)) {
        const pending = this.pendingRequests.get(msg.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(msg.requestId);
          pending.resolve(msg);
        }
      } else {
        this._handleRPC(msg, rinfo);
      }
    } catch (e) {
    }
  }

  async _handleRPC(msg, rinfo) {
    switch (msg.type) {
      case 'PING': {
        const resp = Protocol.createResponse(msg);
        resp.senderId = this.nodeId.toString('hex');
        this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        break;
      }

      case 'FIND_NODE': {
        const targetId = msg.payload.targetId;
        const targetBuf = Buffer.from(targetId, 'hex');
        const closest = this.routingTable.getClosest(targetBuf, this.k);
        const nodes = closest.map(e => ({
          nodeId: e.nodeId.toString('hex'),
          address: e.address,
          port: e.port
        }));
        const resp = Protocol.createResponse(msg, { nodes });
        resp.senderId = this.nodeId.toString('hex');
        this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        break;
      }

      case 'STORE': {
        const { key, value } = msg.payload;
        this.dht.setLocal(key, value);
        const resp = Protocol.createResponse(msg, { stored: true });
        resp.senderId = this.nodeId.toString('hex');
        this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        break;
      }

      case 'FIND_VALUE': {
        const key = msg.payload.key;
        const localValue = this.dht.getLocal(key);
        if (localValue !== null) {
          const resp = Protocol.createResponse(msg, { value: localValue });
          resp.senderId = this.nodeId.toString('hex');
          this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        } else {
          const keyBuf = Buffer.from(key, 'hex');
          const closest = this.routingTable.getClosest(keyBuf, this.k);
          const nodes = closest.map(e => ({
            nodeId: e.nodeId.toString('hex'),
            address: e.address,
            port: e.port
          }));
          const resp = Protocol.createResponse(msg, { nodes });
          resp.type = 'FOUND_NODES';
          resp.senderId = this.nodeId.toString('hex');
          this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        }
        break;
      }

      case 'GOSSIP': {
        const payload = msg.payload;
        if (payload.type === 'heartbeat') {
        } else if (payload.key && payload.key.startsWith('cmd:')) {
          console.log(`[${this.identity}] GOT COMMAND: ${payload.key} = ${payload.value}`);
        }

        this.gossip.propagate(msg, `${rinfo.address}:${rinfo.port}`);

        const resp = Protocol.createResponse(msg, { received: true });
        resp.senderId = this.nodeId.toString('hex');
        this._sendRaw(rinfo.address, rinfo.port, resp).catch(() => {});
        break;
      }
    }
  }

  _refresh() {
    const allNodes = this.routingTable.getAll();
    if (allNodes.length === 0) return;

    for (let i = 0; i < 3; i++) {
      const randomId = crypto.randomBytes(20).toString('hex');
      this.findNode(randomId).catch(() => {});
    }
  }
}

module.exports = Node;
