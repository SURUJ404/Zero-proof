#!/usr/bin/env node

'use strict';

const argv = require('minimist')(process.argv.slice(2));
const Node = require('../src/node');
const crypto = require('crypto');

const command = argv._[0] || 'help';

function showBanner() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════════════╗');
  console.log('  ║                   T S C - P 2 P N E T                     ║');
  console.log('  ║          Decentralized P2P Botnet Network   v1.0.1         ║');
  console.log('  ║   Kademlia DHT · gossip protocol · command & control       ║');
  console.log('  ╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function help() {
  showBanner();
  console.log(`
USAGE:
  tsc-p2pnet node --port <port> --id <identity> --bootstrap <host:port>
    Start a P2P node

  tsc-p2pnet send --key <key> --value <value> --bootstrap <host:port>
    Gossip a command to the network

  tsc-p2pnet status --bootstrap <host:port>
    Query network status

  tsc-p2pnet store --key <key> --value <value> --bootstrap <host:port>
    Store a value in the DHT

  tsc-p2pnet lookup --key <key> --bootstrap <host:port>
    Look up a value in the DHT

  tsc-p2pnet help
    Show this help
`);
}

async function cmdNode() {
  showBanner();
  const port = parseInt(argv.port, 10) || 0;
  const identity = argv.id || `node-${crypto.randomBytes(4).toString('hex')}`;
  const bootstrap = argv.bootstrap ? argv.bootstrap.split(',').map(s => s.trim()) : [];

  const node = new Node({ identity, port });
  await node.start();

  console.log(`Node started: ${node.nodeId.toString('hex')}`);
  console.log(`Identity: ${identity}`);
  console.log(`Port: ${node.port}`);
  console.log(`Bootstrap: ${bootstrap.join(', ') || 'none'}`);

  if (bootstrap.length > 0) {
    console.log('Bootstrapping...');
    await node.join(bootstrap);
    console.log(`Routing table has ${node.routingTable.size()} peers`);
  }

  const allPeers = node.routingTable.getAll();
  for (const p of allPeers.slice(0, 10)) {
    console.log(`  peer ${p.nodeId.toString('hex').substring(0, 16)}... @ ${p.address}:${p.port}`);
  }

  console.log('Listening... (Ctrl+C to stop)');

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await node.stop();
    process.exit(0);
  });
}

async function cmdSend() {
  showBanner();
  const key = argv.key;
  const value = argv.value;
  const bootstrap = parseBootstrap(argv.bootstrap);

  if (!key || !value) {
    console.error('Error: --key and --value are required');
    process.exit(1);
  }

  const node = new Node({ identity: `client-${crypto.randomBytes(4).toString('hex')}` });
  await node.start();

  if (bootstrap.length > 0) {
    await node.join(bootstrap);
  }

  console.log(`Gossiping: ${key} = ${value}`);
  await node.gossip(key, value);
  console.log('Message propagated. Waiting for network to distribute...');

  await delay(2000);
  await node.stop();
  console.log('Done.');
}

async function cmdStatus() {
  showBanner();
  const bootstrap = parseBootstrap(argv.bootstrap);

  const node = new Node({ identity: `client-${crypto.randomBytes(4).toString('hex')}` });
  await node.start();

  if (bootstrap.length > 0) {
    await node.join(bootstrap);
  }

  console.log(`Local Node ID: ${node.nodeId.toString('hex').substring(0, 16)}...`);
  console.log(`Local Port: ${node.port}`);
  console.log(`Known peers: ${node.routingTable.size()}`);

  const allPeers = node.routingTable.getAll();
  if (allPeers.length > 0) {
    console.log('\nPeers in routing table:');
    for (const p of allPeers) {
      console.log(`  ${p.nodeId.toString('hex').substring(0, 16)}... @ ${p.address}:${p.port} (seen ${new Date(p.lastSeen).toISOString()})`);
    }
  } else {
    console.log('No peers discovered. Is the network reachable?');
  }

  await node.stop();
}

async function cmdStore() {
  showBanner();
  const key = argv.key;
  const value = argv.value;
  const bootstrap = parseBootstrap(argv.bootstrap);

  if (!key || !value) {
    console.error('Error: --key and --value are required');
    process.exit(1);
  }

  const node = new Node({ identity: `client-${crypto.randomBytes(4).toString('hex')}` });
  await node.start();

  if (bootstrap.length > 0) {
    await node.join(bootstrap);
  }

  console.log(`Storing: ${key} = ${value}`);
  const results = await node.store(key, value);

  if (results.length === 0) {
    console.log('No peers to store on. Ensure --bootstrap connects you to the network.');
  } else {
    for (const r of results) {
      console.log(`  ${r.node}: ${r.success ? 'OK' : 'FAIL: ' + r.error}`);
    }
  }

  await node.stop();
}

async function cmdLookup() {
  showBanner();
  const key = argv.key;
  const bootstrap = parseBootstrap(argv.bootstrap);

  if (!key) {
    console.error('Error: --key is required');
    process.exit(1);
  }

  const node = new Node({ identity: `client-${crypto.randomBytes(4).toString('hex')}` });
  await node.start();

  if (bootstrap.length > 0) {
    await node.join(bootstrap);
  }

  console.log(`Looking up: ${key}`);
  const result = await node.findValue(key);

  if (result.found) {
    console.log(`Found: ${result.value}`);
    console.log(`Source: ${result.source}`);
  } else {
    console.log('Value not found in DHT');
  }

  await node.stop();
}

function parseBootstrap(bootstrapStr) {
  if (!bootstrapStr) return [];
  return bootstrapStr.split(',').map(s => s.trim()).filter(Boolean);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  switch (command) {
    case 'node':
      await cmdNode();
      break;
    case 'send':
      await cmdSend();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'store':
      await cmdStore();
      break;
    case 'lookup':
      await cmdLookup();
      break;
    case 'help':
    default:
      help();
      process.exit(0);
  }
})().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
