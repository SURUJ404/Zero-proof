#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  string: ['port', 'host'],
  alias: { h: 'help', v: 'version', p: 'port' },
});

const VERSION = '1.0.0';
const BANNER = `
  ╔═══════════════════════════════════════════════════════════════╗
  ║               T S C - W I R E S H I F T                    ║
  ║     HTTP/HTTPS Traffic Interception & Analysis Proxy       ║
  ║                      v${VERSION.padStart(5)}                        ║
  ╚═══════════════════════════════════════════════════════════════╝
`;

function showHelp() {
  console.log(BANNER);
  console.log(`Usage:
  tsc-wireshift proxy [--port <port>] [--host <host>]
  tsc-wireshift --help
  tsc-wireshift --version

Options:
  --port, -p  Proxy port (default: 8080)
  --host      Bind address (default: 127.0.0.1)
  --help, -h  Show this help
  --version   Show version
`);
}

function showVersion() {
  console.log(`tsc-wireshift v${VERSION}`);
}

function log(prefix, msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] [${prefix}] ${msg}`);
}

function startProxy(port, host) {
  const requests = [];

  const server = http.createServer((req, res) => {
    const reqId = requests.length + 1;
    const reqUrl = `${req.method} ${req.url}`;
    const entry = { id: reqId, method: req.method, url: req.url, headers: req.headers, timestamp: Date.now() };
    requests.push(entry);

    log('REQ', `${req.method} ${req.url}`);

    const parsed = url.parse(req.url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.path,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(opts, (proxyRes) => {
      entry.status = proxyRes.statusCode;
      log('RES', `${req.method} ${req.url} -> ${proxyRes.statusCode}`);
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      entry.error = err.message;
      log('ERR', `${req.method} ${req.url}: ${err.message}`);
      res.writeHead(502);
      res.end('Proxy error: ' + err.message);
    });

    req.pipe(proxyReq);
  });

  server.on('connect', (req, clientSocket, head) => {
    const [targetHost, targetPort] = req.url.split(':');
    const reqId = requests.length + 1;
    const entry = { id: reqId, method: 'CONNECT', url: req.url, timestamp: Date.now() };
    requests.push(entry);

    log('CON', `CONNECT ${req.url}`);

    const serverSocket = net.connect(targetPort || 443, targetHost, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
      entry.error = err.message;
      log('ERR', `CONNECT ${req.url}: ${err.message}`);
      clientSocket.end();
    });

    clientSocket.on('error', (err) => {
      entry.error = err.message;
      serverSocket.end();
    });
  });

  server.listen(port, host, () => {
    console.log(BANNER);
    log('INFO', `Proxy server running at http://${host}:${port}`);
    log('INFO', 'Press Ctrl+C to stop');
  });

  process.on('SIGINT', () => {
    log('INFO', `Shutting down. Intercepted ${requests.length} requests.`);
    server.close();
    process.exit(0);
  });
}

const command = argv._[0];

if (argv.help || !command) {
  showHelp();
  process.exit(0);
}

if (argv.version) {
  showVersion();
  process.exit(0);
}

switch (command) {
  case 'proxy':
    startProxy(argv.port || 8080, argv.host || '127.0.0.1');
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
