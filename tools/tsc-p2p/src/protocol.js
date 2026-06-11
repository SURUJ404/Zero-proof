'use strict';

const crypto = require('crypto');

const REQUEST_TYPES = ['PING', 'FIND_NODE', 'STORE', 'FIND_VALUE', 'GOSSIP'];
const RESPONSE_TYPES = ['PONG', 'FOUND_NODES', 'STORED', 'VALUE', 'GOSSIP_ACK'];
const MAX_PACKET_SIZE = 1400;

class Protocol {
  static createMessage(type, senderId, payload = {}, ttl = 5) {
    return {
      type,
      senderId: senderId.toString('hex'),
      requestId: crypto.randomBytes(4).readUInt32BE(0),
      senderAddr: null,
      ttl,
      payload
    };
  }

  static encode(msg) {
    const str = JSON.stringify(msg);
    const buf = Buffer.from(str, 'utf8');
    if (buf.length > MAX_PACKET_SIZE) {
      throw new Error(`Message too large: ${buf.length} bytes > ${MAX_PACKET_SIZE}`);
    }
    return buf;
  }

  static decode(buf) {
    const str = buf.toString('utf8');
    return JSON.parse(str);
  }

  static isRequest(type) {
    return REQUEST_TYPES.includes(type);
  }

  static isResponse(type) {
    return RESPONSE_TYPES.includes(type);
  }

  static responseTypeFor(requestType) {
    const map = {
      'PING': 'PONG',
      'FIND_NODE': 'FOUND_NODES',
      'STORE': 'STORED',
      'FIND_VALUE': 'VALUE',
      'GOSSIP': 'GOSSIP_ACK'
    };
    return map[requestType];
  }

  static createResponse(request, additionalPayload = {}) {
    return {
      type: Protocol.responseTypeFor(request.type),
      senderId: null,
      requestId: request.requestId,
      senderAddr: null,
      ttl: request.ttl,
      payload: { ...additionalPayload }
    };
  }
}

module.exports = Protocol;
