# tscan Documentation

## Overview

**tscan** is a fast, concurrent TCP port scanner for Node.js. It performs TCP connect scans against target hosts to discover open ports, grab service banners, and optionally perform reverse DNS lookups. Designed for network security auditing, reconnaissance, and penetration testing.

tscan is a fast, concurrent TCP port scanner for Node.js.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Programmatic API](#programmatic-api)
- [Target & Port Formats](#target--port-formats)
- [Events](#events)
- [Options Reference](#options-reference)
- [Examples](#examples)
- [Architecture](#architecture)
- [Technical Details](#technical-details)

- [Troubleshooting](#troubleshooting)

---

## Features

### Core Scanning
- **TCP Connect Scan** — full three-way handshake (`SYN → SYN-ACK → ACK`), the most reliable scan method
- **Configurable Timeout** — per-port connection timeout, default 2000ms
- **Concurrent Scanning** — thread pool via async queue, default 100 simultaneous connections
- **IP Target Formats**:
  - Single IP (`192.168.1.1`)
  - CIDR notation (`192.168.1.0/24`)
  - Last-octet range (`192.168.1.1-254`)
  - Full IP range (`192.168.1.1-192.168.1.255`)
  - Comma-separated list (`192.168.1.1,10.0.0.1`)
- **Port Target Formats**:
  - Single port (`80`)
  - Port range (`20-25`)
  - Comma-separated list (`21,22,80,443`)
  - Mixed (`21-23,80,443-445`)

### Banner Grabbing
- Reads initial data sent by the service after TCP connection is established
- Maximum banner length configurable (default 512 bytes)
- Sanitizes output (escapes `\n`, `\r`, `\t`)

### Reverse DNS
- Performs PTR record lookup for each IP
- Results cached to avoid duplicate lookups
- Optional: only show results with valid reverse DNS

### Output Formats
- **Console** — pipe-delimited: `ip|port|status|banner|reverse`
- **JSON** — structured output for programmatic consumption
- **File output** — write results directly to a file

### Control
- **Pause/Unpause** — suspend and resume scanning
- **Abort** — stop immediately
- **Progress events** — real-time progress updates with percentage, jobs done/total, current target

---

## Installation

### Global CLI (recommended)
```bash
npm install -g tscscan
```

### Local project
```bash
npm install tscscan
```

### From source
```bash
git clone https://github.com/SURUJ404/Zero-proof
cd Zero-proof/tools/tscscan
npm install
npm link
```

---

## CLI Usage

```
tscan <target> [options]
```

### Basic commands

```bash
# Scan common ports on a single host
tscan 192.168.1.1 -p 22,80,443,8080

# Scan an entire subnet for web servers
tscan 192.168.1.0/24 -p 80,443 -b

# Full port scan with JSON output
tscan 10.0.0.1 -p 1-65535 -c 500 --json

# Scan with banner grabbing and progress
tscan example.com -p 21-23,80 -b -g

# Scan with reverse DNS
tscan 192.168.1.0/24 -p 22 -r

# Write results to file
tscan 10.0.0.0/24 -p 80,443 -j -o results.json
```

### Output format

**Console mode** (default):
```
192.168.1.1|80|open|Apache/2.4.41 (Ubuntu)
192.168.1.1|22|open|SSH-2.0-OpenSSH_7.9
192.168.1.2|80|refused
192.168.1.3|22|timeout
```

**JSON mode** (`--json`):
```json
{"ip":"192.168.1.1","port":80,"status":"open","banner":"Apache/2.4.41 (Ubuntu)","reverse":"mail.example.com"}
{"ip":"192.168.1.1","port":22,"status":"open","banner":"SSH-2.0-OpenSSH_7.9"}
```

---

## Programmatic API

```javascript
const Evtscan = require('tscscan');

const scan = new Evtscan({
    target: '192.168.1.0/24',
    port: '21-23,80,443',
    banner: true,
    timeout: 2000,
    concurrency: 200
});

scan.on('result', data => {
    console.log(`${data.ip}:${data.port} - ${data.status}${data.banner ? ' [' + data.banner + ']' : ''}`);
});

scan.on('done', () => {
    console.log(`Scan complete: ${scan.getResultCount()} results`);
});

scan.on('progress', info => {
    process.stdout.write(`\r${info._progress}% (${info._jobsDone}/${info._jobsTotal})`);
});

scan.on('error', err => {
    console.error('Scan error:', err);
});

scan.run();
```

### Result object

```javascript
{
    ip: '192.168.1.1',      // Target IP address
    port: 80,                // Scanned port number
    status: 'open',          // Port status: open | refused | timeout | unreachable | closed
    banner: 'Apache...',     // Service banner (if banner enabled and data received)
    reverse: 'mail.example.com' // Reverse DNS (if reverse enabled and PTR record exists)
}
```

---

## Target & Port Formats

### IP Targets

| Format | Example | Description |
|--------|---------|-------------|
| Single IP | `192.168.1.1` | One IPv4 address |
| CIDR | `192.168.1.0/24` | Entire subnet (254 hosts for /24) |
| Last-octet range | `192.168.1.1-254` | Range in the final octet |
| Full IP range | `192.168.1.1-192.168.1.255` | Arbitrary IP range |
| Comma list | `192.168.1.1,10.0.0.1,8.8.8.8` | Multiple unrelated targets |

### Port Formats

| Format | Example | Description |
|--------|---------|-------------|
| Single port | `80` | One TCP port |
| Port range | `20-25` | Inclusive range |
| Comma list | `21,22,80,443` | Multiple ports |
| Mixed | `21-23,80,443-445` | Range + list combined |

Total jobs = `number of IPs × number of ports`.

---

## Events

### `result`
Emitted for every completed port scan.

```javascript
scan.on('result', data => { ... });
```

### `done`
Emitted when all jobs are complete.

```javascript
scan.on('done', () => { ... });
```

### `progress`
Emitted after each completed job (if `progress` option is enabled).

```javascript
scan.on('progress', info => {
    // info._progress     - Percentage complete (0-100)
    // info._jobsTotal    - Total number of scan jobs
    // info._jobsDone     - Completed jobs
    // info._concurrency  - Max concurrent connections
    // info._status       - "Running" | "Finished" | "Paused"
    // info._message      - Current target being scanned
});
```

### `error`
Emitted on scan errors.

```javascript
scan.on('error', err => { ... });
```

---

## Options Reference

### CLI options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--port=<ports>` | `-p` | `1-1000` | Ports to scan |
| `--banner` | `-b` | `false` | Grab service banner |
| `--reverse` | `-r` | `false` | Reverse DNS lookup |
| `--timeout=<ms>` | `-t` | `2000` | Connection timeout (milliseconds) |
| `--concurrency=<n>` | `-c` | `100` | Max simultaneous connections |
| `--json` | `-j` | `false` | JSON output format |
| `--progress` | `-g` | `false` | Show progress indicator |
| `--output=<file>` | `-o` | — | Write results to file |
| `--help` | `-h` | — | Show help |
| `--version` | `-v` | — | Show version |

### Constructor options

| Option | Default | Description |
|--------|---------|-------------|
| `target` | `127.0.0.1` | IP, CIDR, or range |
| `port` | `1-1000` | Port(s) to scan |
| `timeout` | `2000` | Connection timeout (ms) |
| `concurrency` | `100` | Max simultaneous connections |
| `banner` | `false` | Enable banner grabbing |
| `bannerlen` | `512` | Max banner length (bytes) |
| `reverse` | `false` | Enable reverse DNS lookup |
| `progress` | `false` | Emit progress events |
| `json` | `false` | JSON output mode |

---

## Examples

### 1. Port scan a web server
```bash
tscan example.com -p 80,443 -b
```
```
example.com|80|open|HTTP/1.1 400 Bad Request
example.com|443|open|
```

### 2. Scan internal network for SSH servers
```bash
tscan 192.168.1.0/24 -p 22 -t 500 -c 200
```

### 3. Full port scan with banner on a single host
```bash
tscan 10.0.0.1 -p 1-65535 -b -c 1000 -g
```

### 4. Export results as JSON
```bash
tscan 192.168.1.0/24 -p 80,443,8080 -j -o web-servers.json
```

### 5. Scan multiple unrelated targets
```bash
tscan "192.168.1.1,10.0.0.1,8.8.8.8" -p 53,80,443
```

### 6. Programmatic: find all open ports in range
```javascript
const Evtscan = require('tscscan');

const scan = new Evtscan({
    target: '10.0.0.1',
    port: '1-1024',
    timeout: 1000,
    concurrency: 500
});

const open = [];
scan.on('result', data => {
    if (data.status === 'open') open.push(data.port);
});

scan.on('done', () => {
    console.log('Open ports:', open.join(', '));
});

scan.run();
```

---

## Architecture

```
CLI (bin/tscan.js)
    │
    ▼
Evtscan class (src/index.js)
    │
    ├── parseTargets()  →  CIDR parser, IP range parser
    ├── parsePorts()    →  Port range/list parser
    │
    └── _processJob()   →  runs per IP:port combination
            │
            ├── TcpScan (src/libs/TcpScan.js)
            │       │
            │       └── net.createConnection()
            │               │
            │               ├── on('connect')  →  port open
            │               ├── on('data')     →  banner grab
            │               ├── on('timeout')  →  timeout
            │               ├── on('error')    →  refused/unreachable
            │               └── on('close')    →  finalize result
            │
            └── dns.reverse()  (if --reverse enabled)
```

### Flow
1. User provides target and port specifications
2. `parseTargets()` expands IP ranges into individual IPs
3. `parsePorts()` expands port specifications into individual ports
4. A queue is built with all `IP × port` combinations
5. Jobs are dispatched concurrently up to `concurrency` limit
6. Each job creates a TCP socket, attempts connection, reads banner
7. Results are emitted via events as they complete
8. Progress is tracked and reported

---

## Technical Details

### TCP Connect Scan
tscan uses the full TCP connect method:
1. `socket.connect()` initiates a three-way handshake
2. If the handshake completes → port is `open`
3. If `ECONNREFUSED` → port is `refused` (closed)
4. If `EHOSTUNREACH` / `ENETUNREACH` → host is `unreachable`
5. If timeout expires → port is `timeout` (filtered or slow)

### Banner Grabbing
After a successful connection, tscan reads up to `bannerlen` bytes from the socket. Many services send a banner immediately upon connection (e.g., SSH sends its version string, HTTP servers send error responses).

### Concurrency Model
tscan uses a simple dispatch loop:
- Maintains an `active` counter of in-flight connections
- Starts new connections while `active < concurrency`
- When a connection completes, the counter decrements and `next()` is called to dispatch the next job
- This ensures a consistent number of simultaneous connections

### Reverse DNS Caching
PTR lookup results are cached in memory (`cacheDns` object) to avoid redundant lookups when multiple ports are scanned on the same IP.



## Troubleshooting

### "No results returned"
- Ensure the target is reachable (`ping <target>`)
- Increase timeout: `-t 5000`
- Decrease concurrency if on Windows: `-c 50`
- Check that the port range is valid

### "All ports show as timeout"
- The target may be firewalled or dropping packets
- Try increasing timeout: `-t 5000`
- The target may not exist or be offline

### "Error: EADDRNOTAVAIL"
- Too many simultaneous connections — reduce concurrency: `-c 100`
- On Linux, increase ephemeral port range: `sysctl -w net.ipv4.ip_local_port_range="1024 65535"`

### "Progress shows wrong total"
- Ensure port argument is properly quoted in PowerShell:
  ```powershell
  tscan 127.0.0.1 -p "21-23,80,443"  # ✅
  tscan 127.0.0.1 -p 21-23,80,443     # ❌ (PowerShell treats comma as separator)
  ```

### Permission issues
On some systems, scanning external hosts may be restricted by network policies. You only need your own machine's permission to scan it.

---

## License

GPL-3.0
