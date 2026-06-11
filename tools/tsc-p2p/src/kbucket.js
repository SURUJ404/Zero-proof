'use strict';

class KBucket {
  constructor(localNodeId, k = 20) {
    this.localNodeId = localNodeId;
    this.k = k;
    this.buckets = [];
    for (let i = 0; i < 160; i++) {
      this.buckets.push([]);
    }
  }

  _bucketIndex(targetId) {
    const d = xorDistance(this.localNodeId, targetId);
    for (let i = 0; i < d.length; i++) {
      if (d[i] !== 0) {
        return i * 8 + Math.clz32(d[i]) - 24;
      }
    }
    return -1;
  }

  update(nodeId, address, port) {
    if (nodeId.equals(this.localNodeId)) return;
    const idx = this._bucketIndex(nodeId);
    if (idx === -1) return;
    const bucket = this.buckets[idx];
    const now = Date.now();
    const existingIdx = bucket.findIndex(e => e.nodeId.equals(nodeId));

    if (existingIdx !== -1) {
      const entry = bucket[existingIdx];
      entry.address = address;
      entry.port = port;
      entry.lastSeen = now;
      bucket.splice(existingIdx, 1);
      bucket.push(entry);
    } else if (bucket.length < this.k) {
      bucket.push({ nodeId, address, port, lastSeen: now, latency: 0 });
    } else {
      if (now - bucket[0].lastSeen > 3600000) {
        bucket.shift();
        bucket.push({ nodeId, address, port, lastSeen: now, latency: 0 });
      }
    }
  }

  getClosest(targetId, count = this.k) {
    const target = typeof targetId === 'string' ? Buffer.from(targetId, 'hex') : targetId;
    const all = [];
    for (let i = 0; i < this.buckets.length; i++) {
      for (const entry of this.buckets[i]) {
        all.push(entry);
      }
    }
    all.sort((a, b) => {
      const da = xorDistance(a.nodeId, target);
      const db = xorDistance(b.nodeId, target);
      return Buffer.compare(da, db);
    });
    return all.slice(0, count);
  }

  getAll() {
    const all = [];
    for (let i = 0; i < this.buckets.length; i++) {
      for (const entry of this.buckets[i]) {
        all.push(entry);
      }
    }
    return all;
  }

  removeNode(nodeId) {
    const idx = this._bucketIndex(nodeId);
    if (idx === -1) return;
    const bucket = this.buckets[idx];
    const entryIdx = bucket.findIndex(e => e.nodeId.equals(nodeId));
    if (entryIdx !== -1) {
      bucket.splice(entryIdx, 1);
    }
  }

  size() {
    let total = 0;
    for (const bucket of this.buckets) total += bucket.length;
    return total;
  }
}

function xorDistance(a, b) {
  const len = Math.min(a.length, b.length);
  const result = Buffer.alloc(len);
  for (let i = 0; i < len; i++) result[i] = a[i] ^ b[i];
  return result;
}

module.exports = KBucket;
