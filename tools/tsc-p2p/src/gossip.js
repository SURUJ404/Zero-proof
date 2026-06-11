'use strict';

const crypto = require('crypto');

class Gossip {
  constructor(node) {
    this.node = node;
    this.seen = new Set();
    this.alpha = 3;
    this.defaultTtl = 5;
    this.heartbeatInterval = 30000;
    this._heartbeatTimer = null;
  }

  start() {
    this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), this.heartbeatInterval);
  }

  stop() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _messageId(msg) {
    return `${msg.type}:${msg.requestId}`;
  }

  hasSeen(msg) {
    return this.seen.has(this._messageId(msg));
  }

  markSeen(msg) {
    this.seen.add(this._messageId(msg));
    if (this.seen.size > 10000) {
      const first = this.seen.values().next().value;
      this.seen.delete(first);
    }
  }

  async propagate(msg, excludeAddr = null) {
    const msgId = this._messageId(msg);
    if (this.seen.has(msgId)) return;
    this.markSeen(msg);

    if (msg.ttl <= 0) return;
    msg.ttl--;

    const closest = this.node.routingTable.getClosest(
      Buffer.from(msg.senderId, 'hex'),
      this.alpha
    );

    for (const entry of closest) {
      if (excludeAddr && `${entry.address}:${entry.port}` === excludeAddr) continue;
      try {
        await this.node._sendRaw(entry.address, entry.port, msg);
      } catch (e) {
      }
    }
  }

  async broadcast(key, value, ttl = this.defaultTtl) {
    const msg = {
      type: 'GOSSIP',
      senderId: this.node.nodeId.toString('hex'),
      requestId: crypto.randomBytes(4).readUInt32BE(0),
      senderAddr: null,
      ttl,
      payload: { key, value }
    };
    this.markSeen(msg);
    await this.propagate(msg);
  }

  async _sendHeartbeat() {
    const msg = {
      type: 'GOSSIP',
      senderId: this.node.nodeId.toString('hex'),
      requestId: crypto.randomBytes(4).readUInt32BE(0),
      senderAddr: null,
      ttl: 3,
      payload: {
        type: 'heartbeat',
        peerCount: this.node.routingTable.size()
      }
    };
    this.markSeen(msg);
    await this.propagate(msg);
  }
}

module.exports = Gossip;
