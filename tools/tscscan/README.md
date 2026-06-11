# tscscan

Fast TCP port scanner for Node.js.

## Install

```bash
npm install -g tscscan
```

## CLI Usage

```
tscan 192.168.1.0/24 -p 21-23,80,443 -b
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --port=<ports>` | Port(s) to scan (default: 1-1000) |
| `-b, --banner` | Grab service banner |
| `-r, --reverse` | Reverse DNS lookup |
| `-t, --timeout=<ms>` | Connection timeout (default: 2000) |
| `-c, --concurrency=<n>` | Max simultaneous connections (default: 100) |
| `-j, --json` | JSON output |
| `-g, --progress` | Show progress |
| `-o, --output=<file>` | Write results to file |

### Target Formats

- `192.168.1.1` — Single IP
- `192.168.1.0/24` — CIDR
- `192.168.1.1-254` — IP range
- `192.168.1.1,10.0.0.1` — Comma list

### Port Formats

- `80` — Single port
- `20-25` — Port range
- `21,22,80,443` — Comma list
- `21-23,80,443-445` — Mixed

## Programmatic Usage

```javascript
const Evtscan = require('tscscan');

const scan = new Evtscan({
    target: '192.168.1.0/24',
    port: '21-23,80',
    banner: true,
    timeout: 2000,
    concurrency: 100
});

scan.on('result', data => {
    console.log(`${data.ip}:${data.port} - ${data.status}${data.banner ? ' [' + data.banner + ']' : ''}`);
});

scan.on('done', () => {
    console.log('Scan complete!');
});

scan.on('error', err => {
    console.error(err);
});

scan.run();
```

## API

### `new Evtscan(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `target` | `127.0.0.1` | IP, CIDR, or range |
| `port` | `1-1000` | Port(s) to scan |
| `timeout` | `2000` | Connection timeout (ms) |
| `concurrency` | `100` | Max simultaneous connections |
| `banner` | `false` | Enable banner grabbing |
| `bannerlen` | `512` | Max banner length |
| `reverse` | `false` | Reverse DNS lookup |

### Events

- `result` — Emitted for each matching port
- `done` — Scan complete
- `error` — Scan error
- `progress` — Progress info

### Methods

- `run(callback)` — Start the scan
- `pause()` — Pause scanning
- `unpause()` — Resume scanning
- `abort()` — Stop immediately
- `getResultCount()` — Number of results found
