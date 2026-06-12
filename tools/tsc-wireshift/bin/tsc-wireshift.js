#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  string: ['port', 'host'],
  alias: { h: 'help', v: 'version', p: 'port' },
});

const VERSION = '1.2.0';
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
  tsc-wireshift [proxy]     Run Node.js proxy server (default)
  tsc-wireshift ui          Launch Wireshift desktop app
  tsc-wireshift --help
  tsc-wireshift --version

Options:
  --port, -p  Proxy port (default: 8080, proxy mode only)
  --host      Bind address (default: 127.0.0.1, proxy mode only)
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
  const requestCount = { http: 0, https: 0 };
  let startTime = Date.now();

  const server = http.createServer((req, res) => {
    if (req.headers.host && (req.headers.host === `${host}:${port}` || req.headers.host === `127.0.0.1:${port}` || req.headers.host === `localhost:${port}`)) {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<!DOCTYPE html><html><head><title>TSC Wireshift Proxy</title><style>body{font-family:system-ui;max-width:600px;margin:50px auto;padding:0 20px;color:#333}h1{color:#1a73e8}.stat{background:#f5f5f5;padding:12px;border-radius:8px;margin:8px 0}</style></head><body><h1>TSC Wireshift</h1><p>HTTP/HTTPS proxy is running.</p><div class="stat"><b>Status:</b> Active</div><div class="stat"><b>Port:</b> ${port}</div><div class="stat"><b>Uptime:</b> ${uptime}s</div><div class="stat"><b>HTTP requests:</b> ${requestCount.http}</div><div class="stat"><b>HTTPS tunnels:</b> ${requestCount.https}</div><p style="margin-top:30px;font-size:14px;color:#666">Configure your browser proxy settings to use this address to intercept traffic.</p></body></html>`);
    }

    const reqId = requests.length + 1;
    const entry = { id: reqId, method: req.method, url: req.url, headers: req.headers, timestamp: Date.now() };
    requests.push(entry);
    requestCount.http++;
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
    requestCount.https++;
    const entry = { id: requests.length + 1, method: 'CONNECT', url: req.url, timestamp: Date.now() };
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

    clientSocket.on('error', () => serverSocket.end());
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

function launchUI() {
  const binaryPath = path.join(__dirname, '..', 'build', 'bin', 'TSC-Wireshift.exe');
  console.log(BANNER);
  console.log('Launching TSC-Wireshift desktop app...');

  const child = spawn(binaryPath, [], { stdio: 'inherit', windowsHide: false });

  child.on('error', (err) => {
    console.error(`Desktop app unavailable (${err.message}).`);
    console.error('Run without --ui to fall back to the Node.js proxy, or build from source.');
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

if (argv.help) {
  showHelp();
  process.exit(0);
}

if (argv.version) {
  showVersion();
  process.exit(0);
}

const command = argv._[0];

if (!command) {
  startProxy(argv.port || 8080, argv.host || '127.0.0.1');
  return;
}

if (command === 'ui') {
  launchUI();
  return;
}

if (command === 'proxy') {
  startProxy(argv.port || 8080, argv.host || '127.0.0.1');
  return;
}

console.error(`Unknown command: ${command}`);
showHelp();
process.exit(1);
