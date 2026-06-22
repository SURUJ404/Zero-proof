const express = require('express');
const cors = require('cors');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const WORK_DIR = process.env.WORK_DIR || path.join(__dirname, 'work');
const BIN_PATH = process.env.ZARATHUSTRA_BIN || path.resolve(__dirname, '..', 'zarathustra');
const STDLIB_PATH = process.env.ZARATHUSTRA_STDLIB || path.resolve(__dirname, '..', 'stdlib');
const MAX_WORKERS = parseInt(process.env.MAX_WORKERS || '4', 10);
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '50', 10);

fs.mkdirSync(WORK_DIR, { recursive: true });

function log(level, msg, data) {
    if (LOG_LEVEL === 'debug' || level === 'error' || level === 'info' && LOG_LEVEL !== 'quiet') {
        const ts = new Date().toISOString();
        const line = data ? `[${ts}] ${level.toUpperCase()} ${msg} ${JSON.stringify(data)}` : `[${ts}] ${level.toUpperCase()} ${msg}`;
        console.log(line);
    }
}

app.use(cors());
app.use(express.json({ limit: `${MAX_FILE_SIZE}mb` }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    const bin = fs.existsSync(path.join(BIN_PATH, 'zarathustra')) ? path.join(BIN_PATH, 'zarathustra') : null;
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        zarathustra: !!bin,
        stdlib: fs.existsSync(STDLIB_PATH),
        workDir: WORK_DIR,
    });
});

function runZarathustra(args) {
    const bin = path.join(BIN_PATH, 'zarathustra');
    if (!fs.existsSync(bin)) {
        return { ok: false, stdout: '', stderr: 'zarathustra binary not found at ' + bin };
    }
    log('debug', 'running', { bin, args, cwd: WORK_DIR });
    try {
        const stdout = execSync(`"${bin}" ${args.join(' ')}`, {
            cwd: WORK_DIR,
            env: { ...process.env, ZOKRATES_STDLIB: STDLIB_PATH },
            encoding: 'utf-8',
            maxBuffer: MAX_FILE_SIZE * 1024 * 1024,
            timeout: 120000,
        });
        log('info', 'command ok', { args: args[0] });
        return { ok: true, stdout: stdout.trim(), stderr: '' };
    } catch (err) {
        log('error', 'command failed', { args: args[0], stderr: (err.stderr || '').slice(0, 200) });
        return {
            ok: false,
            stdout: err.stdout?.trim() || '',
            stderr: err.stderr?.trim() || err.message,
        };
    }
}

app.post('/api/compile', (req, res) => {
    const { code, curve } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ ok: false, stderr: 'Missing or invalid "code" field.' });
    }
    const id = crypto.randomUUID();
    const inputFile = path.join(WORK_DIR, `${id}.zarathustra`);
    try {
        fs.writeFileSync(inputFile, code);
        const args = ['compile', '-i', inputFile, '--curve', curve || 'bn128'];
        const result = runZarathustra(args);

        let output = { constraints: 0 };
        const outBin = path.join(WORK_DIR, 'out');
        if (fs.existsSync(outBin)) {
            output.binary = fs.readFileSync(outBin).toString('base64');
        }
        const abiFile = path.join(WORK_DIR, 'abi.json');
        if (fs.existsSync(abiFile)) {
            try { output.abi = JSON.parse(fs.readFileSync(abiFile, 'utf-8')); } catch {}
        }
        const match = result.stdout.match(/(\d+)/);
        output.constraints = match ? parseInt(match[1]) : 0;
        res.json({ ...result, output });
    } finally {
        try { fs.unlinkSync(inputFile); } catch {}
    }
});

app.post('/api/compute-witness', (req, res) => {
    const { args: abiArgs } = req.body;
    const outBin = path.join(WORK_DIR, 'out');
    const abiSpecFile = path.join(WORK_DIR, 'abi.json');
    if (!fs.existsSync(outBin)) {
        return res.json({ ok: false, stderr: 'No compiled program. Compile first.' });
    }

    const bin = path.join(BIN_PATH, 'zarathustra');
    const args = ['compute-witness', '-i', outBin, '--output', path.join(WORK_DIR, 'witness')];
    if (abiArgs && fs.existsSync(abiSpecFile)) {
        args.push('--abi', '-s', abiSpecFile, '--stdin');
    }

    try {
        const proc = execFileSync(bin, args, {
            cwd: WORK_DIR,
            env: { ...process.env, ZOKRATES_STDLIB: STDLIB_PATH },
            encoding: 'utf-8',
            maxBuffer: MAX_FILE_SIZE * 1024 * 1024,
            timeout: 120000,
            input: abiArgs ? JSON.stringify(abiArgs) : undefined,
        });
        let witness = '';
        const witnessFile = path.join(WORK_DIR, 'witness');
        if (fs.existsSync(witnessFile)) {
            witness = fs.readFileSync(witnessFile).toString('base64');
        }
        log('info', 'witness ok');
        res.json({ ok: true, stdout: proc.trim(), witness });
    } catch (err) {
        log('error', 'witness failed', { stderr: (err.stderr || '').slice(0, 200) });
        res.json({
            ok: false,
            stdout: err.stdout?.trim() || '',
            stderr: err.stderr?.trim() || err.message,
            witness: '',
        });
    }
});

app.post('/api/setup', (req, res) => {
    const outBin = path.join(WORK_DIR, 'out');
    if (!fs.existsSync(outBin)) {
        return res.json({ ok: false, stderr: 'No compiled program. Compile first.' });
    }
    const result = runZarathustra(['setup', '-i', outBin]);
    const provingKey = path.join(WORK_DIR, 'proving.key');
    const verificationKey = path.join(WORK_DIR, 'verification.key');
    res.json({
        ...result,
        provingKey: fs.existsSync(provingKey) ? fs.readFileSync(provingKey).toString('base64') : null,
        verificationKey: fs.existsSync(verificationKey) ? fs.readFileSync(verificationKey).toString('base64') : null,
    });
});

app.post('/api/prove', (req, res) => {
    const outBin = path.join(WORK_DIR, 'out');
    const witnessFile = path.join(WORK_DIR, 'witness');
    const provingKey = path.join(WORK_DIR, 'proving.key');
    if (!fs.existsSync(outBin) || !fs.existsSync(witnessFile) || !fs.existsSync(provingKey)) {
        return res.json({ ok: false, stderr: 'Missing compiled program, witness, or proving key.' });
    }
    const result = runZarathustra(['generate-proof', '--input', outBin, '--witness', witnessFile, '--proving-key-path', provingKey]);
    const proofFile = path.join(WORK_DIR, 'proof.json');
    let proof = null;
    if (fs.existsSync(proofFile)) {
        try { proof = JSON.parse(fs.readFileSync(proofFile, 'utf-8')); } catch {}
    }
    res.json({ ...result, proof });
});

app.post('/api/verify', (req, res) => {
    const proofFile = path.join(WORK_DIR, 'proof.json');
    const verificationKey = path.join(WORK_DIR, 'verification.key');
    if (!fs.existsSync(proofFile) || !fs.existsSync(verificationKey)) {
        return res.json({ ok: false, stderr: 'Missing proof or verification key.' });
    }
    const result = runZarathustra(['verify', '-v', verificationKey, '-j', proofFile]);
    res.json(result);
});

app.post('/api/export-verifier', (req, res) => {
    const verificationKey = path.join(WORK_DIR, 'verification.key');
    if (!fs.existsSync(verificationKey)) {
        return res.json({ ok: false, stderr: 'No verification key. Run setup first.' });
    }
    const result = runZarathustra(['export-verifier', '-i', verificationKey]);
    res.json(result);
});

app.post('/api/reset', (req, res) => {
    for (const f of ['out', 'witness', 'proving.key', 'verification.key', 'proof.json', 'abi.json', 'args.json']) {
        const p = path.join(WORK_DIR, f);
        if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch {}
    }
    res.json({ ok: true });
});

const server = app.listen(PORT, HOST, () => {
    console.log(`Zarathustra Web IDE running at http://${HOST}:${PORT}`);
    console.log(`  Binary: ${BIN_PATH}/zarathustra`);
    console.log(`  Stdlib: ${STDLIB_PATH}`);
    console.log(`  Work:   ${WORK_DIR}`);
});

process.on('SIGTERM', () => { log('info', 'SIGTERM received, shutting down'); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { log('info', 'SIGINT received, shutting down'); server.close(() => process.exit(0)); });
