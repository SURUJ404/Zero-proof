'use strict';

const crypto = require('crypto');

const VALUE_TTL = 3600000;

class DHT {
  constructor(node) {
    this.node = node;
    this.localStore = new Map();
    this._republishTimer = null;
  }

  start() {
    this._republishTimer = setInterval(() => this._republish(), 300000);
  }

  stop() {
    if (this._republishTimer) {
      clearInterval(this._republishTimer);
      this._republishTimer = null;
    }
  }

  async store(key, value) {
    const keyHash = crypto.createHash('sha1').update(key).digest();
    const keyHex = keyHash.toString('hex');

    this.localStore.set(keyHex, { value, timestamp: Date.now() });

    const closest = this.node.routingTable.getClosest(keyHash, this.node.k);
    const results = [];

    for (const entry of closest) {
      try {
        await this.node._sendRPC(entry.address, entry.port, 'STORE', {
          key: keyHex,
          value: value,
          ttl: VALUE_TTL
        });
        results.push({ node: `${entry.address}:${entry.port}`, success: true });
      } catch (e) {
        results.push({ node: `${entry.address}:${entry.port}`, success: false, error: e.message });
      }
    }

    return results;
  }

  async findValue(key) {
    const keyHash = crypto.createHash('sha1').update(key).digest();
    const keyHex = keyHash.toString('hex');

    if (this.localStore.has(keyHex)) {
      return { found: true, value: this.localStore.get(keyHex).value, source: 'local' };
    }

    const queried = new Set();
    let closest = this.node.routingTable.getClosest(keyHash, this.node.alpha || 3);

    while (closest.length > 0) {
      for (const entry of closest) {
        const addr = `${entry.address}:${entry.port}`;
        if (queried.has(addr)) continue;
        queried.add(addr);

        try {
          const resp = await this.node._sendRPC(entry.address, entry.port, 'FIND_VALUE', {
            key: keyHex
          });

          if (resp.type === 'VALUE' && resp.payload.value !== undefined) {
            return { found: true, value: resp.payload.value, source: addr };
          }

          if (resp.type === 'FOUND_NODES' && resp.payload.nodes) {
            for (const n of resp.payload.nodes) {
              const nId = Buffer.from(n.nodeId, 'hex');
              if (!queried.has(`${n.address}:${n.port}`)) {
                this.node.routingTable.update(nId, n.address, n.port);
              }
            }
          }
        } catch (e) {
        }
      }

      closest = this.node.routingTable.getClosest(keyHash, this.node.alpha || 3)
        .filter(e => !queried.has(`${e.address}:${e.port}`));

      if (queried.size > 20) break;
    }

    return { found: false };
  }

  getLocal(key) {
    const entry = this.localStore.get(key);
    if (entry && Date.now() - entry.timestamp < VALUE_TTL) {
      return entry.value;
    }
    if (entry) this.localStore.delete(key);
    return null;
  }

  setLocal(key, value) {
    this.localStore.set(key, { value, timestamp: Date.now() });
  }

  _republish() {
    const now = Date.now();
    for (const [key, entry] of this.localStore) {
      if (now - entry.timestamp > VALUE_TTL) {
        this.localStore.delete(key);
      } else {
        const keyBuf = Buffer.from(key, 'hex');
        const closest = this.node.routingTable.getClosest(keyBuf, this.node.k);
        for (const c of closest) {
          this.node._sendRPC(c.address, c.port, 'STORE', {
            key, value: entry.value, ttl: VALUE_TTL
          }).catch(() => {});
        }
      }
    }
  }
}

module.exports = DHT;
