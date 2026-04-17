#!/usr/bin/env node
'use strict';

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const APP_NAME   = 'monitorRecurso';
const CONFIG_DIR = path.join(os.homedir(), '.monitorrecurso');
const PID_FILE   = path.join(CONFIG_DIR, 'app.pid');
const ROOT       = path.join(__dirname, '..');

// ── Binary path ────────────────────────────────────────────────────────────

function binaryPath() {
  const plat = process.platform;
  const bin  = path.join(ROOT, 'build', 'bin');
  if (plat === 'darwin') return path.join(bin, `${APP_NAME}.app`, 'Contents', 'MacOS', APP_NAME);
  if (plat === 'win32')  return path.join(bin, `${APP_NAME}.exe`);
  return path.join(bin, APP_NAME);
}

// ── Process helpers ────────────────────────────────────────────────────────

function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid() {
  try {
    const n = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    return isNaN(n) ? null : n;
  } catch { return null; }
}

// ── Commands ───────────────────────────────────────────────────────────────

function cmdStatus() {
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`running  (PID ${pid})`);
    return true;
  }
  console.log('stopped');
  return false;
}

function cmdStart() {
  const pid = readPid();
  if (pid && isRunning(pid)) {
    console.log(`already running (PID ${pid})`);
    return;
  }

  const bin = binaryPath();
  if (!fs.existsSync(bin)) {
    console.error(`Binary not found: ${bin}`);
    console.error('Run `npm run build` (requires Go + Wails) inside the project directory.');
    process.exit(1);
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const child = spawn(bin, [], { detached: true, stdio: 'ignore' });
  child.unref();
  // PID file is written by the Go process itself; also write here as fallback
  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log(`started  (PID ${child.pid})`);
}

function cmdStop() {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    fs.rmSync(PID_FILE, { force: true });
    console.log('not running');
    return;
  }
  try { process.kill(pid, 'SIGTERM'); } catch {}
  fs.rmSync(PID_FILE, { force: true });
  console.log(`stopped  (PID ${pid})`);
}

function cmdReload() {
  cmdStop();
  // brief pause so the TCP lock port is released before re-bind
  setTimeout(cmdStart, 600);
}

// ── Autostart ──────────────────────────────────────────────────────────────

function autostartEnable() {
  const bin  = binaryPath();
  const plat = process.platform;

  if (plat === 'darwin') {
    const plistDir  = path.join(os.homedir(), 'Library', 'LaunchAgents');
    const plistFile = path.join(plistDir, 'com.kaicmurilo.monitorrecurso.plist');
    fs.mkdirSync(plistDir, { recursive: true });
    fs.writeFileSync(plistFile, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>com.kaicmurilo.monitorrecurso</string>
  <key>ProgramArguments</key>  <array><string>${bin}</string></array>
  <key>RunAtLoad</key>         <true/>
  <key>KeepAlive</key>         <false/>
  <key>StandardOutPath</key>   <string>${CONFIG_DIR}/stdout.log</string>
  <key>StandardErrorPath</key> <string>${CONFIG_DIR}/stderr.log</string>
</dict>
</plist>
`);
    try { execSync(`launchctl load -w "${plistFile}"`, { stdio: 'inherit' }); } catch {}
    console.log('autostart enabled  →  ~/Library/LaunchAgents/com.kaicmurilo.monitorrecurso.plist');

  } else if (plat === 'linux') {
    const desktopDir  = path.join(os.homedir(), '.config', 'autostart');
    const desktopFile = path.join(desktopDir, 'monitorrecurso.desktop');
    fs.mkdirSync(desktopDir, { recursive: true });
    fs.writeFileSync(desktopFile,
`[Desktop Entry]
Type=Application
Name=Monitor Recurso
Exec=${bin}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
`);
    console.log(`autostart enabled  →  ${desktopFile}`);

  } else if (plat === 'win32') {
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    execSync(`reg add "${key}" /v MonitorRecurso /t REG_SZ /d "${bin}" /f`);
    console.log('autostart enabled  →  HKCU\\...\\Run\\MonitorRecurso');

  } else {
    console.error(`autostart: unsupported platform (${plat})`);
  }
}

function autostartDisable() {
  const plat = process.platform;

  if (plat === 'darwin') {
    const plistFile = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.kaicmurilo.monitorrecurso.plist');
    try { execSync(`launchctl unload -w "${plistFile}"`, { stdio: 'inherit' }); } catch {}
    fs.rmSync(plistFile, { force: true });
    console.log('autostart disabled');

  } else if (plat === 'linux') {
    fs.rmSync(path.join(os.homedir(), '.config', 'autostart', 'monitorrecurso.desktop'), { force: true });
    console.log('autostart disabled');

  } else if (plat === 'win32') {
    try { execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v MonitorRecurso /f`); } catch {}
    console.log('autostart disabled');
  }
}

// ── Help ───────────────────────────────────────────────────────────────────

function help() {
  console.log(`
  monitor-recurso <command>

  Commands:
    start                   Iniciar o widget em background
    stop                    Parar o widget
    reload                  Reiniciar o widget
    status                  Ver se está rodando

    autostart enable        Iniciar automaticamente com o sistema
    autostart disable       Remover inicialização automática

  Examples:
    monitor-recurso start
    monitor-recurso reload
    monitor-recurso autostart enable
`);
}

// ── Dispatch ───────────────────────────────────────────────────────────────

const [,, cmd, sub] = process.argv;

switch (cmd) {
  case 'start':      cmdStart();  break;
  case 'stop':       cmdStop();   break;
  case 'reload':     cmdReload(); break;
  case 'status':     cmdStatus(); break;
  case 'autostart':
    if (sub === 'enable')       autostartEnable();
    else if (sub === 'disable') autostartDisable();
    else { console.error('Usage: monitor-recurso autostart <enable|disable>'); process.exit(1); }
    break;
  default:
    help();
}
