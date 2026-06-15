class Obfuscator {
  constructor() {
    this._varCounter = 0;
    this._readableNames = [
      '_loop', '_temp', '_counter', '_result', '_idx', '_ptr',
      '_buf', '_len', '_key', '_val', '_tmp', '_arr', '_obj',
      '_fn', '_x', '_y', '_z', '_i', '_j', '_k', '_a', '_b',
      '_c', '_d', '_e', '_f', '_s', '_t', '_u', '_v', '_w',
      '_data', '_pos', '_off', '_inc', '_dec', '_mod', '_res'
    ];
  }

  randomVarName() {
    this._varCounter++;
    const style = Math.floor(Math.random() * 4);
    switch (style) {
      case 0: {
        const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16);
        return `_0x${hex}`;
      }
      case 1: {
        const base = this._readableNames[
          Math.floor(Math.random() * this._readableNames.length)
        ];
        return `${base}${this._varCounter}`;
      }
      case 2: {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return `_${letters[Math.floor(Math.random() * 26)]}${this._varCounter}`;
      }
      case 3: {
        const hex = (this._varCounter * 0x1F).toString(16);
        return `_${hex}`;
      }
    }
  }

  deadCode() {
    const style = Math.floor(Math.random() * 8);
    const v = () => this.randomVarName();
    switch (style) {
      case 0:
        return `var ${v()}=${Math.floor(Math.random() * 1000)};`;
      case 1: {
        const a = v();
        const b = v();
        const limit = Math.floor(Math.random() * 15 + 5);
        return `for(var ${a}=0;${a}<${limit};${a}++){var ${b}=${Math.floor(Math.random() * 100)};}`;
      }
      case 2: {
        const a = v();
        const b = v();
        return `var ${a}=function(${b}){return ${b}*${Math.floor(Math.random() * 10 + 2)};};var ${v()}=${a}(${Math.floor(Math.random() * 10)});`;
      }
      case 3:
        return `var ${v()}=[${Array.from({ length: Math.floor(Math.random() * 4 + 2) }, () => Math.floor(Math.random() * 100)).join(',')}];`;
      case 4: {
        const a = v();
        const b = v();
        return `var ${a}=typeof ${b}!=='undefined'?${b}:${Math.floor(Math.random() * 100)};`;
      }
      case 5: {
        const a = v();
        return `var ${a}=JSON.parse('${JSON.stringify({ _: Math.random().toString(36).substring(2, 10) })}');`;
      }
      case 6: {
        const a = v();
        const b = v();
        return `var ${a}=Buffer.from('${Math.random().toString(36).substring(2, 10)}','utf8');var ${b}=${a}.length;`;
      }
      case 7:
        return `var ${v()}=Math.random()*${Math.floor(Math.random() * 100 + 10)};`;
    }
  }

  deadCodeBlock(count) {
    const blocks = [];
    for (let i = 0; i < count; i++) {
      blocks.push(this.deadCode());
    }
    return blocks.join('');
  }

  obfuscateString(str) {
    const scheme = Math.floor(Math.random() * 3);
    const varName = this.randomVarName();
    let code;

    switch (scheme) {
      case 0: {
        const hex = Buffer.from(str, 'utf8').toString('hex');
        code = `var ${varName}=Buffer.from('${hex}','hex').toString('utf8');`;
        break;
      }
      case 1: {
        const b64 = Buffer.from(str, 'utf8').toString('base64');
        code = `var ${varName}=Buffer.from('${b64}','base64').toString('utf8');`;
        break;
      }
      case 2: {
        const key = Math.floor(Math.random() * 254 + 1);
        const xored = Buffer.from(str, 'utf8').map(b => b ^ key).toString('hex');
        const lv = this.randomVarName();
        code = `var ${varName}=Buffer.from('${xored}','hex');for(var ${lv}=0;${lv}<${varName}.length;${lv}++){${varName}[${lv}]^=${key};}${varName}=${varName}.toString('utf8');`;
        break;
      }
    }

    return { varName, code };
  }

  substituteOps(code) {
    let result = code;
    const coin = Math.random();

    if (coin < 0.3) {
      result = result.replace(/(\w+)\s*===\s*(\w+)/g, '$1==$2');
    } else if (coin < 0.6) {
      result = result.replace(/Math\.floor\(/g, '~~(');
    }

    return result;
  }

  flattenControlFlow(code) {
    const stateVar = this.randomVarName();
    const dispatchVar = this.randomVarName();
    const caseVal = Math.floor(Math.random() * 5000 + 100);

    const numFake = Math.floor(Math.random() * 3 + 2);
    const fakeStates = [];
    for (let i = 0; i < numFake; i++) {
      fakeStates.push(Math.floor(Math.random() * 9000 + 1000));
    }

    const allStates = [caseVal, ...fakeStates];
    const shuffled = allStates.sort(() => Math.random() - 0.5);
    const realIdx = shuffled.indexOf(caseVal);

    let wrapper = `(function(){var ${stateVar}=${shuffled[0]};var ${dispatchVar}=[${stateVar}];while(${dispatchVar}.length>0){switch(${dispatchVar}.shift()){`;

    for (let i = 0; i < shuffled.length; i++) {
      const s = shuffled[i];
      if (s === caseVal) {
        wrapper += `case ${s}:${code}`;
        if (i < shuffled.length - 1) {
          wrapper += `${dispatchVar}.push(${shuffled[i + 1]});`;
        }
        wrapper += `break;`;
      } else {
        wrapper += `case ${s}:${this.deadCode()}`;
        if (i < shuffled.length - 1) {
          wrapper += `${dispatchVar}.push(${shuffled[i + 1]});`;
        } else {
          wrapper += `${dispatchVar}.push(${caseVal});`;
        }
        wrapper += `break;`;
      }
    }

    wrapper += `default:break;}}})();`;
    return wrapper;
  }
}

module.exports = Obfuscator;
