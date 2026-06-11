const crypto = require('crypto');

class Crypter {
  generateAESKey() {
    return crypto.randomBytes(32);
  }

  generateIV() {
    return crypto.randomBytes(16);
  }

  generateXORKey() {
    return crypto.randomBytes(16);
  }

  encrypt(plaintext) {
    const aesKey = this.generateAESKey();
    const iv = this.generateIV();
    const xorKey = this.generateXORKey();

    const plainBuf = Buffer.from(plaintext, 'utf8');
    const xored = Buffer.alloc(plainBuf.length);
    for (let i = 0; i < plainBuf.length; i++) {
      xored[i] = plainBuf[i] ^ xorKey[i % xorKey.length];
    }

    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    const encrypted = Buffer.concat([cipher.update(xored), cipher.final()]);

    return {
      data: encrypted.toString('base64'),
      aesKey: aesKey.toString('hex'),
      iv: iv.toString('hex'),
      xorKey: xorKey.toString('hex')
    };
  }

  decrypt(encryptedBase64, aesKeyHex, ivHex, xorKeyHex) {
    const aesKey = Buffer.from(aesKeyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const xorKey = Buffer.from(xorKeyHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final()
    ]);

    const result = Buffer.alloc(decrypted.length);
    for (let i = 0; i < decrypted.length; i++) {
      result[i] = decrypted[i] ^ xorKey[i % xorKey.length];
    }

    return result.toString('utf8');
  }
}

module.exports = Crypter;
