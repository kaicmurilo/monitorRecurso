'use strict';

const { execSync } = require('child_process');
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

if (process.env.SKIP_DOWNLOAD) {
  console.log('monitor-recurso: SKIP_DOWNLOAD set — skipping binary download.');
  process.exit(0);
}

const VERSION  = require('../package.json').version;
const REPO     = 'kaicmurilo/monitorRecurso';
const ROOT     = path.join(__dirname, '..');
const PLATFORM = process.platform;
const ARCH     = process.arch; // 'x64' | 'arm64'

const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' };

function assetName() {
  const a = ARCH_MAP[ARCH];
  if (!a) return null;
  if (PLATFORM === 'darwin') return `monitor-recurso-darwin-${a}.tar.gz`;
  if (PLATFORM === 'linux')  return `monitor-recurso-linux-${a}.tar.gz`;
  if (PLATFORM === 'win32')  return `monitor-recurso-windows-amd64.zip`; // only amd64 available
  return null;
}

function binaryPath() {
  const bin = path.join(ROOT, 'build', 'bin');
  if (PLATFORM === 'darwin') return path.join(bin, 'monitorRecurso.app', 'Contents', 'MacOS', 'monitorRecurso');
  if (PLATFORM === 'win32')  return path.join(bin, 'monitorRecurso.exe');
  return path.join(bin, 'monitorRecurso');
}

if (fs.existsSync(binaryPath())) {
  console.log('monitor-recurso: binary already exists — done.');
  process.exit(0);
}

const asset = assetName();
if (!asset) {
  console.warn(`monitor-recurso: unsupported platform (${PLATFORM}/${ARCH}) — skipping download.`);
  process.exit(0);
}

const url     = `https://github.com/${REPO}/releases/download/v${VERSION}/${asset}`;
const tmpFile = path.join(os.tmpdir(), asset);

console.log(`monitor-recurso: downloading ${asset}...`);

function download(url, dest, cb) {
  const mod  = url.startsWith('https') ? https : http;
  const file = fs.createWriteStream(dest);

  mod.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      file.close();
      fs.rmSync(dest, { force: true });
      return download(res.headers.location, dest, cb);
    }
    if (res.statusCode !== 200) {
      file.close();
      fs.rmSync(dest, { force: true });
      return cb(new Error(`HTTP ${res.statusCode} — ${url}`));
    }
    res.pipe(file);
    file.on('finish', () => file.close(cb));
  }).on('error', (err) => {
    fs.rmSync(dest, { force: true });
    cb(err);
  });
}

download(url, tmpFile, (err) => {
  if (err) {
    console.warn(`monitor-recurso: download failed — ${err.message}`);
    console.warn('Install Go + Wails and run `wails build -clean` manually.');
    process.exit(0); // non-fatal
  }

  const binDir = path.join(ROOT, 'build', 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  try {
    if (PLATFORM === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Force '${tmpFile}' '${binDir}'"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`tar -xzf "${tmpFile}" -C "${binDir}"`, { stdio: 'inherit' });
    }

    // Ensure binary is executable
    const bin = binaryPath();
    if (PLATFORM !== 'win32' && fs.existsSync(bin)) {
      fs.chmodSync(bin, 0o755);
    }

    // macOS: remove Gatekeeper quarantine flag added to downloaded files
    if (PLATFORM === 'darwin') {
      const appBundle = path.join(binDir, 'monitorRecurso.app');
      if (fs.existsSync(appBundle)) {
        try {
          execSync(`xattr -dr com.apple.quarantine "${appBundle}"`, { stdio: 'pipe' });
        } catch {} // xattr may not be available in all environments
      }
    }

    console.log('monitor-recurso: ready.');
  } catch (e) {
    console.warn(`monitor-recurso: extraction failed — ${e.message}`);
    console.warn('Download manually from https://github.com/' + REPO + '/releases');
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});
