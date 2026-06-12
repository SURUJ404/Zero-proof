#!/usr/bin/env node

'use strict';

const minimist = require('minimist');
const fingerprint = require('../src/fingerprint');
const evasion = require('../src/evasion');
const sandbox = require('../src/sandbox');
const avdetect = require('../src/avdetect');
const { BeaconController, runTrainingSimulation } = require('../src/beacon');

const argv = minimist(process.argv.slice(2), {
  boolean: ['json', 'train', 'help'],
  string: ['interval'],
  alias: { j: 'json', t: 'train', h: 'help', i: 'interval' },
});

const command = argv._[0];

function showBanner() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════════════╗');
  console.log('  ║                T S C - A I   E V A S I O N                 ║');
  console.log('  ║    AI-Driven Dynamic Targeting & Evasion Engine  v1.0.1    ║');
  console.log('  ║   sandbox detection · AV/EDR fingerprint · Q-learning      ║');
  console.log('  ╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function showHelp() {
  showBanner();
  console.log(`Usage:
  tsc-ai scan              Full environment fingerprint scan
  tsc-ai evade             Scan + recommend best evasion technique
  tsc-ai sandbox-test      Check if current environment is sandbox/VM
  tsc-ai beacon [--interval auto]  Start adaptive beacon timer
  tsc-ai learn --train     Run reinforcement learning simulation
  tsc-ai report --json     Full scan + evasion report as JSON
  tsc-ai --help            Show this help

Options:
  --json, -j      Output as JSON
  --train, -t     Run training simulation
  --interval, -i  Beacon interval (default: auto)
  --help, -h      Show help
`);
}

async function cmdScan() {
  showBanner();
  const report = fingerprint.run();
  return report;
}

async function cmdEvade() {
  showBanner();
  const fp = fingerprint.run();
  const technique = evasion.selectEvasion(fp);
  return { fingerprint: fp, evasion: technique };
}

async function cmdSandboxTest() {
  showBanner();
  const result = sandbox.analyze();
  return result;
}

async function cmdBeacon() {
  showBanner();
  const controller = new BeaconController();
  const interval = argv.interval || 'auto';

  console.log('Starting beacon controller...');
  console.log(`Interval mode: ${interval}`);
  console.log('');

  const simLength = 20;
  for (let i = 0; i < simLength; i++) {
    const beacon = controller.nextBeacon();
    const success = Math.random() < 0.75;
    controller.reportResult(success);

    const status = success ? '✓ SUCCESS' : '✗ BLOCKED';
    const marker = success ? '+' : '-';
    const bar = marker.repeat(Math.max(1, Math.round((controller.successfulBeacons / Math.max(1, controller.totalBeacons)) * 20)));

    console.log(
      `[${i + 1}/${simLength}] ${status} | ` +
      `interval=${Math.round(beacon.actualInterval / 1000)}s ` +
      `jitter=${Math.round(beacon.jitter * 100)}% ` +
      `successRate=${controller.getStats().successRate}% ` +
      `[${bar}]`
    );

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\nFinal beacon stats:');
  console.log(JSON.stringify(controller.getStats(), null, 2));
  return controller.getStats();
}

async function cmdLearn() {
  showBanner();
  console.log('Running reinforcement learning training simulation...\n');
  const result = runTrainingSimulation(50);
  console.log(`Q-Table size: ${result.qTableSize} states`);
  console.log(`Final stats: ${JSON.stringify(result.finalStats, null, 2)}`);

  const topEpisodes = result.episodes.slice(0, 5);
  for (const ep of topEpisodes) {
    console.log(`  Episode ${ep.episode}: env=${ep.env} net=${ep.network} | successRate=${ep.stats.successRate}% interval=${ep.stats.currentInterval}ms`);
  }

  return result;
}

async function cmdReport() {
  showBanner();
  const fp = fingerprint.run();
  const technique = evasion.selectEvasion(fp);
  const report = {
    timestamp: new Date().toISOString(),
    tool: 'TSC-AI Evasion Engine',
    version: '1.0.0',
    author: 'SURUJ404',
    fingerprint: fp,
    evasion: technique,
    beacon: {
      recommendedInterval: calculateRecommendedInterval(fp),
    },
  };
  return report;
}

function calculateRecommendedInterval(fp) {
  if (fp.sandbox.score >= 60) return 3600000;
  if (fp.sandbox.score >= 30) return 300000;
  if (fp.securityProducts.edr.length > 0) return 1800000;
  if (fp.securityProducts.antivirus.length > 0) return 300000;
  return 30000;
}

async function main() {
  if (argv.help || !command) {
    showHelp();
    return;
  }

  let result;

  switch (command) {
    case 'scan':
      result = await cmdScan();
      break;
    case 'evade':
      result = await cmdEvade();
      break;
    case 'sandbox-test':
      result = await cmdSandboxTest();
      break;
    case 'beacon':
      result = await cmdBeacon();
      return;
    case 'learn':
      result = await cmdLearn();
      break;
    case 'report':
      result = await cmdReport();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }

  if (result) {
    if (argv.json || command === 'report') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printFormatted(result, command);
    }
  }
}

function printFormatted(result, cmd) {
  if (cmd === 'scan') {
    printFingerprint(result);
  } else if (cmd === 'evade') {
    printFingerprint(result.fingerprint);
    console.log('');
    printEvasion(result.evasion);
  } else if (cmd === 'sandbox-test') {
    printSandboxResult(result);
  }
}

function printFingerprint(fp) {
  console.log('=== ENVIRONMENT FINGERPRINT ===');
  console.log(`OS:        ${fp.os.name || fp.os.distro || fp.os.platform} (${fp.os.release})`);
  console.log(`Arch:      ${fp.architecture}`);
  console.log(`Hostname:  ${fp.environment.hostname}`);
  console.log(`Privilege: ${fp.privileges.isAdmin ? 'ADMIN' : fp.privileges.isRoot ? 'ROOT' : 'USER'}`);
  console.log(`Network:   ${fp.network.type}`);
  console.log(`CPU:       ${fp.environment.cpus} cores`);
  console.log(`RAM:       ${fp.environment.totalMemory}`);
  console.log(`Uptime:    ${Math.round(fp.environment.uptime ? fp.environment.uptime / 3600 : 0)}h`);
  console.log('');

  const sb = fp.sandbox;
  console.log('=== SANDBOX ANALYSIS ===');
  console.log(`Score:     ${sb.score}/100 (${sb.verdict})`);
  if (sb.details.processes.length > 0) console.log(`Processes: ${sb.details.processes.join(', ')}`);
  if (sb.details.drivers.length > 0) console.log(`Drivers:   ${sb.details.drivers.join(', ')}`);
  if (sb.details.analysisTools.length > 0) console.log(`Tools:     ${sb.details.analysisTools.join(', ')}`);
  if (sb.details.vmMacAddresses.length > 0) console.log(`VM MACs:   ${sb.details.vmMacAddresses.map(m => m.mac).join(', ')}`);
  console.log('');

  const sec = fp.securityProducts;
  console.log('=== SECURITY PRODUCTS ===');
  if (sec.antivirus.length > 0) {
    for (const av of sec.antivirus) console.log(`  AV: ${av.name}`);
  } else {
    console.log('  No AV detected');
  }
  if (sec.edr.length > 0) {
    for (const edr of sec.edr) console.log(`  EDR: ${edr.name}`);
  } else {
    console.log('  No EDR detected');
  }
  if (sec.wmiDetected.length > 0) {
    for (const w of sec.wmiDetected) console.log(`  WMI: ${w.name}`);
  }
}

function printEvasion(ev) {
  console.log('=== RECOMMENDED EVASION ===');
  console.log(`Technique:  ${ev.technique}`);
  console.log(`Risk Level: ${ev.riskLevel.toUpperCase()}`);
  console.log(`Description: ${ev.description}`);
  console.log('');
  if (ev.bypassCommands && ev.bypassCommands.length > 0) {
    console.log('Commands:');
    for (const cmd of ev.bypassCommands) {
      console.log(`  $ ${cmd}`);
    }
  }
  if (ev.reasoning) {
    console.log('');
    console.log('Reasoning:');
    for (const r of ev.reasoning) {
      console.log(`  • ${r}`);
    }
  }
}

function printSandboxResult(result) {
  console.log('=== SANDBOX DETECTION RESULT ===');
  console.log(`Score:   ${result.score}/100`);
  console.log(`Verdict: ${result.verdict.toUpperCase()}`);
  console.log('');
  console.log('Indicators:');
  const d = result.details;
  if (d.processes.length > 0) console.log(`  Suspicious processes: ${d.processes.join(', ')}`);
  if (d.drivers.length > 0) console.log(`  VM drivers: ${d.drivers.join(', ')}`);
  if (d.analysisTools.length > 0) console.log(`  Analysis tools: ${d.analysisTools.join(', ')}`);
  if (d.vmMacAddresses.length > 0) console.log(`  VM MACs: ${d.vmMacAddresses.map(m => m.mac).join(', ')}`);
  if (d.uptime.suspicious) console.log(`  Low uptime: ${d.uptime.hours}h`);
  if (d.debuggerDetected && d.debuggerDetected.debuggerDetected) console.log(`  Debugger detected: ${d.debuggerDetected.methods.join(', ')}`);
  if (d.screenResolution.suspicious) console.log(`  Low resolution: ${d.screenResolution.width}x${d.screenResolution.height}`);
  console.log('');
  console.log(`Recommendation: ${result.verdict === 'sandbox' ? 'ABORT — sandbox environment' : result.verdict === 'suspicious' ? 'CAUTION — proceed with evasion' : 'CLEAN — safe to operate'}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
