const { execSync } = require('child_process');
const os = require('os');

const AV_PRODUCTS = {
  'Windows Defender': {
    processes: ['MsMpEng.exe', 'NisSrv.exe', 'MpCmdRun.exe', 'MSASCui.exe', 'SecurityHealthService.exe'],
    services: ['WinDefend', 'WdBoot', 'WdNisSvc', 'SecurityHealthService'],
  },
  'Kaspersky': {
    processes: ['avp.exe', 'kavfs.exe', 'kavfswp.exe', 'ksde.exe'],
    services: ['AVP', 'KAVFS', 'KAVFSGT'],
  },
  'ESET': {
    processes: ['ekrn.exe', 'egui.exe', 'ecls.exe', 'euf.exe'],
    services: ['ekrn', 'eamon', 'EhttpSrv'],
  },
  'Norton': {
    processes: ['ccSvcHst.exe', 'ns.exe', 'ccSvcHst.exe', 'rtvscan.exe'],
    services: ['Norton Internet Security', 'ccSetMgr', 'ccEvtMgr'],
  },
  'McAfee': {
    processes: ['McShield.exe', 'McTaskManager.exe', 'McAPExe.exe', 'mfevtps.exe'],
    services: ['McAfeeFramework', 'McShield', 'McTaskManager', 'McAPExe'],
  },
  'BitDefender': {
    processes: ['bdagent.exe', 'bdservicehost.exe', 'bds.exe', 'bdss.exe'],
    services: ['BitDefender', 'BitDefender Agent', 'BitDefender Security Service'],
  },
  'Avast': {
    processes: ['avastui.exe', 'avastsvc.exe', 'ashAvast.exe', 'aswBcc.exe'],
    services: ['avast! Antivirus', 'aswBoot', 'aswMonFlt'],
  },
  'Sophos': {
    processes: ['SophosUI.exe', 'SophosService.exe', 'SAVAdmin.exe', 'SAVService.exe'],
    services: ['Sophos Anti-Virus', 'Sophos Agent', 'Sophos MCS Agent'],
  },
  'Trend Micro': {
    processes: ['PccNTMon.exe', 'TmProxy.exe', 'TmccSF.exe', 'ntrtscan.exe'],
    services: ['Trend Micro', 'TmFilter', 'TmPreFilter'],
  },
};

const EDR_PRODUCTS = {
  'CrowdStrike Falcon': {
    processes: ['CSFalconService.exe', 'CSFalconContainer.exe', 'falcond.exe'],
    services: ['CrowdStrike Falcon', 'CSFalconService'],
  },
  'SentinelOne': {
    processes: ['SentinelAgent.exe', 'SentinelStatic.exe', 'SentinelService.exe'],
    services: ['Sentinel Agent', 'SentinelOne'],
  },
  'Carbon Black': {
    processes: ['RepMgr.exe', 'RepUtility.exe', 'UbtServ.exe', 'CB.exe'],
    services: ['CarbonBlack', 'CbDefense', 'CbResponse'],
  },
  'Microsoft Defender for Endpoint': {
    processes: ['MsSense.exe', 'SenseIR.exe', 'SenseSampleUploader.exe', 'SenseNdr.exe'],
    services: ['Sense', 'WdNisSvc', 'WinDefend'],
  },
  'Cybereason': {
    processes: ['CRsensor.exe', 'CybereonService.exe'],
    services: ['Cybereason', 'Cybereason ActiveProbe'],
  },
};

function getRunningProcesses() {
  try {
    const isWin = process.platform === 'win32';
    if (isWin) {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', timeout: 5000 });
      return output.toLowerCase().split('\n').map(l => l.trim()).filter(Boolean);
    } else {
      const output = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
      return output.toLowerCase();
    }
  } catch (e) {
    return [];
  }
}

function getServices() {
  try {
    if (process.platform !== 'win32') return [];
    const output = execSync('sc query state= all', { encoding: 'utf8', timeout: 5000 });
    const lines = output.toLowerCase().split('\n');
    const services = [];
    for (const line of lines) {
      const m = line.match(/SERVICE_NAME:\s+(.+)/);
      if (m) services.push(m[1].trim());
    }
    return services;
  } catch (e) {
    return [];
  }
}

function detect() {
  const detected = [];
  const procs = getRunningProcesses();
  const procsStr = Array.isArray(procs) ? procs.join(' ') : procs;
  const services = getServices();

  for (const [name, info] of Object.entries(AV_PRODUCTS)) {
    let found = false;
    for (const proc of info.processes) {
      if (procsStr.includes(proc.toLowerCase())) {
        found = true;
        break;
      }
    }
    if (!found) {
      for (const svc of info.services) {
        if (services.some(s => s.includes(svc.toLowerCase()))) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      detected.push({ name, type: 'AV' });
    }
  }

  return detected;
}

function detectEDR() {
  const detected = [];
  const procs = getRunningProcesses();
  const procsStr = Array.isArray(procs) ? procs.join(' ') : procs;
  const services = getServices();

  for (const [name, info] of Object.entries(EDR_PRODUCTS)) {
    let found = false;
    for (const proc of info.processes) {
      if (procsStr.includes(proc.toLowerCase())) {
        found = true;
        break;
      }
    }
    if (!found) {
      for (const svc of info.services) {
        if (services.some(s => s.includes(svc.toLowerCase()))) {
          found = true;
          break;
        }
      }
    }
    if (found) {
      detected.push({ name, type: 'EDR' });
    }
  }

  return detected;
}

function detectWMI() {
  const products = [];
  try {
    if (process.platform !== 'win32') return products;
    const output = execSync('wmic /namespace:\\\\root\\securitycenter2 path antivirusproduct get displayname', { encoding: 'utf8', timeout: 5000 });
    const lines = output.trim().split('\n').slice(1);
    for (const line of lines) {
      const name = line.trim();
      if (name) {
        products.push({ name, source: 'WMI' });
      }
    }
  } catch (e) {
    // skip (may not have permissions)
  }
  return products;
}

module.exports = {
  detect,
  detectEDR,
  detectWMI,
};
