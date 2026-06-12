const express = require('express');
const path = require('path');
const { execSync, spawn } = require('child_process');
const fingerprint = require('../fingerprint');
const sandbox = require('../sandbox');
const avdetect = require('../avdetect');
const evasion = require('../evasion');
const { BeaconController } = require('../beacon');

function createServer(port = 3456) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const beaconCtrl = new BeaconController();

  app.get('/api/scan', (req, res) => {
    try {
      const result = fingerprint.run();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sandbox', (req, res) => {
    try {
      const result = sandbox.analyze();
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/av', (req, res) => {
    try {
      res.json({
        av: avdetect.detect(),
        edr: avdetect.detectEDR(),
        wmi: avdetect.detectWMI(),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/evade', (req, res) => {
    try {
      const fp = fingerprint.run();
      const selected = evasion.selectEvasion(fp);
      res.json({ fingerprint: fp, evasion: selected });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/beacon/start', (req, res) => {
    try {
      beaconCtrl.__proto__ = new BeaconController().__proto__;
      Object.assign(beaconCtrl, new BeaconController());
      res.json({ status: 'started' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/beacon/step', (req, res) => {
    try {
      const success = req.body.success !== undefined ? req.body.success : Math.random() < 0.75;
      const beacon = beaconCtrl.nextBeacon();
      beaconCtrl.reportResult(success);
      res.json({
        step: beacon,
        success,
        stats: beaconCtrl.getStats(),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/beacon/stats', (req, res) => {
    try {
      res.json(beaconCtrl.getStats());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });

      const ollama = spawn('ollama', ['run', 'codellama']);
      let output = '';
      let responded = false;

      ollama.stdout.on('data', (data) => {
        output += data.toString();
      });

      ollama.stdin.write(message);
      ollama.stdin.end();

      ollama.on('close', (code) => {
        if (!responded) { responded = true; res.json({ response: output.trim() || '(no response from Ollama)' }); }
      });

      ollama.on('error', () => {
        if (!responded) { responded = true; res.json({ response: 'Ollama not running. Start it with: ollama run codellama' }); }
      });

      setTimeout(() => {
        if (!responded) { responded = true; ollama.kill(); res.json({ response: output.trim() || '(timeout - Ollama may not be running)' }); }
      }, 30000);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/terminal/exec', (req, res) => {
    try {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'command required' });
      const output = execSync(command, { encoding: 'utf8', timeout: 10000, shell: true });
      res.json({ output: output.trim() || '(no output)' });
    } catch (e) {
      res.json({ output: e.stderr ? e.stderr.trim() : e.message });
    }
  });

  return app;
}

module.exports = { createServer };
