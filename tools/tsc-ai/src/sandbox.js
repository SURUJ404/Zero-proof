const { execSync } = require('child_process');
const os = require('os');

const SANDBOX_PROCESSES = [
  'vmtoolsd', 'VBoxTray', 'VBoxControl', 'prl_cc', 'prl_tools',
  'xenservice', 'xentools', 'qemu-ga', 'wireshark', 'procmon',
  'procmon64', 'Procmon', 'Procmon64', 'Process Monitor',
  'ProcessMonitor', 'ida', 'ida64', 'idaq', 'idaq64',
  'x64dbg', 'x32dbg', 'ollydbg', 'ImmunityDebugger',
  'windbg', 'dnSpy', 'dumpcap', 'procexp', 'procexp64',
  'Process Explorer', 'tcpview', 'Autoruns', 'Regedit',
];

const VM_DRIVERS_WINDOWS = [
  'VBoxGuest', 'VBoxMouse', 'VBoxSF', 'VBoxVideo',
  'vmci', 'vmmouse', 'vm3dgl', 'vmusbmouse',
  'vmx_svga', 'vmscsi', 'vmxnet', 'vmxnet3',
  'xennet', 'xeniface', 'xencrpt', 'xenbus',
  'hgfs', 'prl_eth', 'prl_net', 'prl_strg',
];

const SUSPICIOUS_USERNAMES = [
  'admin', 'sandbox', 'malware', 'virus', 'test',
  'user', 'vm', 'virtual', 'analysis', 'malwr',
  'cuckoo', 'remnux', 'forensic', 'win7', 'win10',
  'victim', 'sample', 'debug', 'evil',
];

const VM_MAC_PREFIXES = [
  '00:05:69', '00:0C:29', '00:1C:42', '00:1C:14',
  '00:50:56', '08:00:27', '00:15:5D',
  '00:03:FF',
];

function checkProcesses() {
  const detected = [];
  try {
    const isWin = process.platform === 'win32';
    let output;
    if (isWin) {
      output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', timeout: 5000 });
    } else {
      output = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
    }
    const lower = output.toLowerCase();
    for (const proc of SANDBOX_PROCESSES) {
      if (lower.includes(proc.toLowerCase())) {
        detected.push(proc);
      }
    }
  } catch (e) {
    // skip
  }
  return detected;
}

function checkDrivers() {
  const detected = [];
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic sysdriver list brief', { encoding: 'utf8', timeout: 5000 });
      const lower = output.toLowerCase();
      for (const drv of VM_DRIVERS_WINDOWS) {
        if (lower.includes(drv.toLowerCase())) {
          detected.push(drv);
        }
      }
    } else if (process.platform === 'linux') {
      const output = execSync('cat /proc/modules', { encoding: 'utf8', timeout: 5000 });
      const lower = output.toLowerCase();
      const linuxDrivers = ['vboxguest', 'vboxsf', 'vboxvideo', 'vmw_vmci', 'vmxnet3', 'xen_blkfront', 'xen_netfront'];
      for (const drv of linuxDrivers) {
        if (lower.includes(drv.toLowerCase())) {
          detected.push(drv);
        }
      }
    }
  } catch (e) {
    // skip
  }
  return detected;
}

function checkHardware() {
  const result = { cpus: 0, ram: 0, diskFree: 0, screen: null };
  try {
    result.cpus = os.cpus().length;
    result.ram = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
    result.freemem = Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100;

    if (process.platform === 'win32') {
      const output = execSync('wmic diskdrive get size', { encoding: 'utf8', timeout: 5000 });
      const lines = output.trim().split('\n').slice(1);
      let total = 0;
      for (const line of lines) {
        const s = parseInt(line.trim(), 10);
        if (!isNaN(s)) total += s;
      }
      result.diskSize = Math.round(total / (1024 * 1024 * 1024) * 100) / 100;
    } else if (process.platform === 'linux') {
      try {
        const out = execSync("df -B1 / | awk 'NR==2{print $2}'", { encoding: 'utf8', timeout: 5000 });
        result.diskSize = Math.round(parseInt(out.trim(), 10) / (1024 * 1024 * 1024) * 100) / 100;
      } catch (e) {
        result.diskSize = 0;
      }
    } else if (process.platform === 'darwin') {
      try {
        const out = execSync("df -B1 / | awk 'NR==2{print $2}'", { encoding: 'utf8', timeout: 5000 });
        result.diskSize = Math.round(parseInt(out.trim(), 10) / (1024 * 1024 * 1024) * 100) / 100;
      } catch (e) {
        result.diskSize = 0;
      }
    } else {
      result.diskSize = 0;
    }
  } catch (e) {
    // skip
  }
  return result;
}

function checkUptime() {
  try {
    const uptimeSec = os.uptime();
    return {
      seconds: uptimeSec,
      hours: Math.round(uptimeSec / 3600 * 100) / 100,
      suspicious: uptimeSec < 3600,
    };
  } catch (e) {
    return { seconds: 0, hours: 0, suspicious: true };
  }
}

function checkUsername() {
  try {
    const user = os.userInfo().username;
    return {
      username: user,
      suspicious: SUSPICIOUS_USERNAMES.includes(user.toLowerCase()),
    };
  } catch (e) {
    return { username: 'unknown', suspicious: false };
  }
}

function checkMacAddress() {
  const detected = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.mac || iface.internal) continue;
        const mac = iface.mac.toUpperCase();
        for (const prefix of VM_MAC_PREFIXES) {
          if (mac.startsWith(prefix.toUpperCase())) {
            detected.push({ interface: name, mac, prefix });
          }
        }
      }
    }
  } catch (e) {
    // skip
  }
  return detected;
}

function checkDebugger() {
  const result = { debuggerDetected: false, methods: [] };
  try {
    if (process.platform === 'win32') {
      try {
        const out = execSync('powershell -Command "[System.Diagnostics.Debugger]::IsAttached"', { encoding: 'utf8', timeout: 5000 });
        if (out.trim() === 'True') {
          result.debuggerDetected = true;
          result.methods.push('IsDebuggerPresent (.NET)');
        }
      } catch (e) {
        // skip
      }
      try {
        const out = execSync('wmic process where "Name=\'tsc-ai.exe\'" get ProcessId /format:csv', { encoding: 'utf8', timeout: 5000 });
        const lower = out.toLowerCase();
        if (lower.includes('ntglobalflag')) {
          result.methods.push('NtGlobalFlag');
        }
      } catch (e) {
        // skip
      }
    }
    if (process.platform === 'linux') {
      const ppid = process.ppid;
      try {
        const out = execSync(`cat /proc/${ppid}/status 2>/dev/null | grep -i tracer`, { encoding: 'utf8', timeout: 5000 });
        if (out.trim()) {
          result.debuggerDetected = true;
          result.methods.push('TracerPid (ptrace)');
        }
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    // skip
  }
  return result;
}

function checkAnalysisTools() {
  const detected = [];
  const tools = [
    'wireshark', 'tshark', 'fiddler', 'burpsuite', 'burp',
    'procmon', 'procmon64', 'procexp', 'procexp64',
    'processhacker', 'ida', 'ida64', 'x64dbg', 'x32dbg',
    'ollydbg', 'immunitydebugger', 'windbg', 'dnspy',
    'regmon', 'filemon', 'tcpview', 'autoruns',
    'hxd', 'hexdump', 'pestudio', 'peid',
  ];
  try {
    const isWin = process.platform === 'win32';
    let output;
    if (isWin) {
      output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', timeout: 5000 });
    } else {
      output = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
    }
    const lower = output.toLowerCase();
    for (const tool of tools) {
      if (lower.includes(tool.toLowerCase())) {
        detected.push(tool);
      }
    }
  } catch (e) {
    // skip
  }
  return detected;
}

function checkScreenResolution() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('powershell -Command "(Add-Type -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern int GetSystemMetrics(int nIndex);\' -Name Win32 -Namespace Win32Functions -PassThru)::GetSystemMetrics(0).ToString() + \'x\' + (Add-Type -MemberDefinition \'[DllImport(\\"user32.dll\\")] public static extern int GetSystemMetrics(int nIndex);\' -Name Win32 -Namespace Win32Functions -PassThru)::GetSystemMetrics(1).ToString()"', { encoding: 'utf8', timeout: 5000 });
      const parts = out.trim().split('x');
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      return {
        width: w,
        height: h,
        suspicious: (w <= 1024 && h <= 768) || (w <= 1280 && h <= 720),
      };
    }
  } catch (e) {
    // skip
  }
  return { width: 0, height: 0, suspicious: false };
}

function analyze() {
  const processes = checkProcesses();
  const drivers = checkDrivers();
  const hardware = checkHardware();
  const uptime = checkUptime();
  const username = checkUsername();
  const macs = checkMacAddress();
  const dbg = checkDebugger();
  const tools = checkAnalysisTools();
  const screen = checkScreenResolution();

  let score = 0;

  if (processes.length > 0) score += 20;
  if (drivers.length > 0) score += 15;
  if (hardware.cpus <= 2) score += 10;
  if (hardware.ram <= 2) score += 10;
  if (hardware.diskSize !== null && hardware.diskSize < 60) score += 10;
  if (uptime.suspicious) score += 15;
  if (username.suspicious) score += 10;
  if (macs.length > 0) score += 15;
  if (dbg.debuggerDetected) score += 20;
  if (tools.length > 0) score += 15;
  if (screen.suspicious) score += 10;

  score = Math.min(score, 100);

  return {
    score,
    verdict: score >= 60 ? 'sandbox' : score >= 30 ? 'suspicious' : 'clean',
    details: {
      processes,
      drivers,
      hardware,
      uptime,
      username,
      vmMacAddresses: macs,
      debuggerDetected: dbg,
      analysisTools: tools,
      screenResolution: screen,
    },
  };
}

module.exports = {
  checkProcesses,
  checkDrivers,
  checkHardware,
  checkUptime,
  checkUsername,
  checkMacAddress,
  checkDebugger,
  checkAnalysisTools,
  checkScreenResolution,
  analyze,
};
