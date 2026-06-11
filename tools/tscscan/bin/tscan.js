#!/usr/bin/env node

const minimist = require('minimist');
const Evtscan = require('../src/index');

const argv = minimist(process.argv.slice(2), {
    alias: {
        'port': 'p',
        'reverse': 'r',
        'banner': 'b',
        'timeout': 't',
        'concurrency': 'c',
        'help': 'h',
        'version': 'v',
        'json': 'j',
        'output': 'o',
        'progress': 'g'
    },
    default: {
        port: '1-1000',
        timeout: 2000,
        concurrency: 100,
        banner: false,
        reverse: false,
        json: false,
        progress: false
    }
});

if (argv.help || argv._.length === 0) {
    console.log(`
tscan - Fast TCP Port Scanner

Usage:
  tscan <target> [options]

Target formats:
  192.168.1.1              Single IP
  192.168.1.0/24           CIDR notation
  192.168.1.1-254          IP range (last octet)
  192.168.1.1-192.168.1.255 Full IP range
  192.168.1.1,10.0.0.1    Comma-separated list

Options:
  -p, --port=<ports>       Port(s) to scan (default: 1-1000)
                            Examples: --port=80
                                      --port=21,22,80
                                      --port=20-100,443
  -b, --banner             Grab service banner
  -r, --reverse            Perform reverse DNS lookup
  -t, --timeout=<ms>       Connection timeout in ms (default: 2000)
  -c, --concurrency=<n>    Max simultaneous connections (default: 100)
  -j, --json               Output as JSON
  -g, --progress           Show progress
  -o, --output=<file>      Write results to file
  -h, --help               Show this help
  -v, --version            Show version

Examples:
  tscan 127.0.0.1
  tscan 192.168.1.0/24 -p 21-23,80,443 -b
  tscan 10.0.0.1 -p 1-65535 -c 500 -j -g
`);
    process.exit(0);
}

if (argv.version) {
    const pkg = require('../package.json');
    console.log(pkg.version);
    process.exit(0);
}

const options = {
    target: argv._[0],
    port: argv.port,
    timeout: argv.timeout,
    concurrency: argv.concurrency,
    banner: argv.banner,
    reverse: argv.reverse,
    json: argv.json,
    progress: argv.progress
};

const scan = new Evtscan(options);

if (argv.output) {
    const fs = require('fs');
    const stream = fs.createWriteStream(argv.output, { flags: 'a' });
    scan.on('result', data => {
        const line = argv.json ? JSON.stringify(data) : 
            `${data.ip}|${data.port}|${data.status}|${data.banner || ''}${data.reverse ? '|' + data.reverse : ''}`;
        stream.write(line + '\n');
    });
    scan.on('done', () => stream.end());
}

scan.on('result', data => {
    if (!argv.output) {
        if (argv.json) {
            console.log(JSON.stringify(data));
        } else {
            const line = `${data.ip}|${data.port}|${data.status}${data.banner ? '|' + data.banner : ''}${data.reverse ? '|' + data.reverse : ''}`;
            console.log(line);
        }
    }
});

scan.on('progress', data => {
    if (argv.progress && !argv.json) {
        process.stdout.write(`\rProgress: ${data._progress}% (${data._jobsDone}/${data._jobsTotal}) - ${data._message}     `);
    }
    if (argv.progress && argv.json) {
        console.log(JSON.stringify(data));
    }
});

scan.on('error', err => {
    console.error('Error:', err.message || err);
});

scan.on('done', () => {
    if (argv.progress && !argv.json) {
        process.stdout.write('\n');
    }
    const resultCount = scan.getResultCount();
    console.error(`\nDone, ${resultCount} result(s)`);
});

scan.run();
