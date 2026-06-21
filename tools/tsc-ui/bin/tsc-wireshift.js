#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const path = require('path');
const fs = require('fs');

const argv = require('minimist')(process.argv.slice(2), {
  boolean: ['help', 'version'],
  string: ['port', 'host'],
  alias: { h: 'help', v: 'version', p: 'port' },
});

const VERSION = '1.3.2';
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
  tsc-wireshift                  Launch desktop app (default)
  tsc-wireshift ui               Launch desktop app
  tsc-wireshift launch ui        Launch desktop app
  tsc-wireshift proxy            Run Node.js proxy server
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

function getBinaryPath() {
  const binName = process.platform === 'win32' ? 'TSC-Wireshift.exe' : 'TSC-Wireshift';
  const bundled = path.join(__dirname, binName);
  if (fs.existsSync(bundled)) return bundled;
  return null;
}

function launchUI() {
  const binaryPath = getBinaryPath();

  if (!binaryPath) {
    console.error('Desktop binary not found for your platform.');
    console.error('Fall back to proxy mode: tsc-wireshift proxy');
    process.exit(1);
  }

  console.log(BANNER);
  console.log('Launching TSC-Wireshift desktop app...');

  const child = spawn(binaryPath, [], { stdio: 'inherit', windowsHide: false });

  child.on('error', (err) => {
    console.error(`Failed to launch desktop app: ${err.message}`);
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

const args = argv._;

if (args.length === 0) {
  return launchUI();
}

if (args[0] === 'ui') {
  return launchUI();
}

if (args[0] === 'launch' && args[1] === 'ui') {
  return launchUI();
}

if (args[0] === 'proxy') {
  return startProxy(argv.port || 8080, argv.host || '127.0.0.1');
}

console.error(`Unknown command: ${args.join(' ')}`);
showHelp();
process.exit(1);
