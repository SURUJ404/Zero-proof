#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const minimist = require('minimist');

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'version'],
  alias: { h: 'help', v: 'version' },
});

const VERSION = '1.1.0';
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
  tsc-wireshift [ui|proxy]   Launch Wireshift desktop app
  tsc-wireshift --help
  tsc-wireshift --version

Options:
  --help, -h  Show this help
  --version   Show version
`);
}

function showVersion() {
  console.log(`tsc-wireshift v${VERSION}`);
}

function launchUI() {
  const binaryPath = path.join(__dirname, '..', 'build', 'bin', 'TSC-Wireshift.exe');
  console.log(BANNER);
  console.log('Launching TSC-Wireshift desktop app...');

  const child = spawn(binaryPath, [], { stdio: 'inherit', windowsHide: false });

  child.on('error', (err) => {
    console.error(`Failed to launch: ${err.message}`);
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

if (!command || command === 'ui' || command === 'proxy') {
  launchUI();
  return;
}

console.error(`Unknown command: ${command}`);
showHelp();
process.exit(1);
