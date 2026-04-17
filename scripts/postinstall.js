'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

if (process.env.SKIP_BUILD) {
  console.log('monitor-recurso: SKIP_BUILD set — skipping binary build.');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const plat = process.platform;

function binaryPath() {
  const bin = path.join(ROOT, 'build', 'bin');
  if (plat === 'darwin') return path.join(bin, 'monitorRecurso.app', 'Contents', 'MacOS', 'monitorRecurso');
  if (plat === 'win32')  return path.join(bin, 'monitorRecurso.exe');
  return path.join(bin, 'monitorRecurso');
}

if (fs.existsSync(binaryPath())) {
  console.log('monitor-recurso: binary already built — done.');
  process.exit(0);
}

console.log('monitor-recurso: building binary (requires Go ≥ 1.21 + Wails CLI)...');

// Check Go
try { execSync('go version', { stdio: 'pipe' }); }
catch {
  console.warn('monitor-recurso: Go not found — skipping build. Install Go and run `wails build -clean` manually.');
  process.exit(0);
}

// Check Wails
const wailsBin = path.join(os.homedir(), 'go', 'bin', 'wails');
const wailsCmd = fs.existsSync(wailsBin) ? wailsBin : 'wails';
try { execSync(`${wailsCmd} version`, { stdio: 'pipe' }); }
catch {
  console.warn('monitor-recurso: Wails CLI not found — skipping build. Run `go install github.com/wailsapp/wails/v2/cmd/wails@latest` then `wails build -clean`.');
  process.exit(0);
}

try {
  execSync(`${wailsCmd} build -clean`, { cwd: ROOT, stdio: 'inherit' });
  console.log('monitor-recurso: build complete.');
} catch {
  console.warn('monitor-recurso: build failed — run `wails build -clean` manually.');
  process.exit(0); // non-fatal: don't break `npm install`
}
