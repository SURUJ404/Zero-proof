#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(REPO, 'tools');
const WEBSITE = path.join(REPO, 'website', 'src', 'pages');

function run(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

function parseCommandsFromHelp(helpText) {
  const lines = helpText.split('\n');
  const commands = [];
  let inUsage = false;
  for (const line of lines) {
    if (line.includes('Usage:')) { inUsage = true; continue; }
    if (inUsage && (line.includes('Options:') || line.includes('--help'))) break;
    if (inUsage && line.includes('tsc-')) {
      const parts = line.trim().split(/\s{2,}/);
      let cmd = parts[0].trim();
      cmd = cmd.replace(/\[|\]/g, '').trim();
      // Extract subcommand after tsc-ai/tsc-wireshift
      const m = cmd.match(/^tsc-\S+\s+(.+)/);
      if (m) cmd = m[1];
      if (cmd && !cmd.startsWith('-')) commands.push(cmd);
    }
  }
  return commands;
}

function getVersion(toolPath) {
  const v = run(`node ${toolPath} --version`, REPO);
  const m = v.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : '';
}

function parseExistingTable(content, heading) {
  const table = {};
  const idx = content.indexOf(heading);
  if (idx === -1) return table;
  const slice = content.slice(idx);
  const lines = slice.split('\n');
  // Skip heading line and blank lines
  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;
  // Skip header row and separator
  if (i < lines.length && lines[i].match(/^\|.*\|.*\|$/)) i++;
  if (i < lines.length && lines[i].includes('---')) i++;
  // Read data rows
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^\|(.+)\|(.+)\|$/);
    if (!m) break;
    const cmd = m[1].trim().replace(/`/g, '').trim();
    const desc = m[2].trim();
    if (cmd && !cmd.includes('---')) table[cmd] = desc;
    i++;
  }
  return table;
}

function updateTscAi() {
  const toolPath = path.join(TOOLS, 'tsc-ai', 'bin', 'tsc-ai.js');
  const mdxPath = path.join(WEBSITE, 'tsc-ai.mdx');
  const help = run(`node ${toolPath} --help`, REPO);
  const version = getVersion(toolPath);
  if (!fs.existsSync(mdxPath)) return;

  let content = fs.readFileSync(mdxPath, 'utf8').replace(/\r/g, '');
  const commands = parseCommandsFromHelp(help);

  const tableStart = content.indexOf('## CLI Reference');
  if (tableStart !== -1) {
    const before = content.slice(0, tableStart);
    const afterEnd = content.indexOf('\n##', tableStart + 1);
    const after = afterEnd !== -1 ? content.slice(afterEnd) : '';

    const existing = parseExistingTable(content, '## CLI Reference');

    const rows = commands.map(c => {
      const key = Object.keys(existing).find(k => k === c || k.startsWith(c));
      const desc = key ? existing[key] : '';
      return `| \`${c}\` | ${desc} |`;
    });

    const table = `## CLI Reference\n\n| Command | Description |\n|---------|-------------|\n${rows.join('\n')}\n`;
    content = before + table + after;
  }

  content = content.replace(/(tsc-ai v?)\d+\.\d+\.\d+/, `$1${version}`);
  fs.writeFileSync(mdxPath, content, 'utf8');
  console.log(`Updated tsc-ai.mdx (v${version}, ${commands.length} commands)`);
}

function updateWireshift() {
  const toolPath = path.join(TOOLS, 'tsc-wireshift', 'bin', 'tsc-wireshift.js');
  const mdxPath = path.join(WEBSITE, 'wireshift.mdx');
  const help = run(`node ${toolPath} --help`, REPO);
  const version = getVersion(toolPath);
  if (!fs.existsSync(mdxPath)) return;

  let content = fs.readFileSync(mdxPath, 'utf8').replace(/\r/g, '');
  const commands = parseCommandsFromHelp(help);

  const tableStart = content.indexOf('## Commands');
  if (tableStart !== -1) {
    const before = content.slice(0, tableStart);
    const afterEnd = content.indexOf('\n##', tableStart + 1);
    const after = afterEnd !== -1 ? content.slice(afterEnd) : '';

    const existing = parseExistingTable(content, '## Commands');

    const rows = commands.map(c => {
      const key = Object.keys(existing).find(k => k === c || k.includes(c));
      const desc = key ? existing[key] : '';
      const fullCmd = c.includes(' ') ? `tsc-wireshift ${c}` : `tsc-wireshift ${c}`;
      return `| \`${fullCmd}\` | ${desc} |`;
    });

    const table = `## Commands\n\n| Command | Description |\n|---------|-------------|\n${rows.join('\n')}\n`;
    content = before + table + after;
  }

  content = content.replace(/(tsc-wireshift v?)\d+\.\d+\.\d+/, `$1${version}`);
  fs.writeFileSync(mdxPath, content, 'utf8');
  console.log(`Updated wireshift.mdx (v${version}, ${commands.length} commands)`);
}

updateTscAi();
updateWireshift();
console.log('Done');
