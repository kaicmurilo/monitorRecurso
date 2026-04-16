'use strict';

// Wails v2 vanilla: bindings injected at runtime on window.go and window.runtime.
// No import statements needed.

let cfg = null;
let pollTimer = null;

// --- Formatters ---

function fmtPct(v) {
  return `${v.toFixed(0)}<span class="unit">%</span>`;
}

function fmtTemp(v) {
  if (!v || v <= 0) return `<span class="unit">N/A</span>`;
  return `${v.toFixed(0)}<span class="unit">°C</span>`;
}

function fmtBytes(bps) {
  if (bps < 0) return `<span class="unit">N/A</span>`;
  if (bps < 1024)         return `${bps.toFixed(0)}<span class="unit">B/s</span>`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)}<span class="unit">K</span>`;
  return `${(bps / (1024 * 1024)).toFixed(1)}<span class="unit">M</span>`;
}

// --- DOM helpers ---

function setCell(id, html, isAlert) {
  document.getElementById(`val-${id}`).innerHTML = html;
  document.getElementById(`cell-${id}`).classList.toggle('alert', isAlert);
}

// --- Metric update ---

async function tick() {
  if (!cfg) return;
  try {
    const m = await window.go.main.App.GetMetrics();
    const t = cfg.Alerts;

    setCell('cpu',     fmtPct(m.CPUPercent),           m.CPUPercent  >= t.CPUPercent);
    setCell('ram',     fmtPct(m.RAMPercent),           m.RAMPercent  >= t.RAMPercent);
    setCell('temp',    fmtTemp(m.CPUTempCelsius),      m.CPUTempCelsius > 0 && m.CPUTempCelsius >= t.CPUTempCelsius);
    setCell('disk',    fmtPct(m.DiskPercent),          m.DiskPercent >= t.DiskPercent);
    setCell('netup',   fmtBytes(m.NetUpBytesPerSec),   false);
    setCell('netdown', fmtBytes(m.NetDownBytesPerSec), false);

    if (m.HasGPU) {
      setCell('gpu', fmtPct(m.GPUPercent), m.GPUPercent >= t.GPUPercent);
    } else {
      document.getElementById('val-gpu').innerHTML = `<span class="unit">N/A</span>`;
      document.getElementById('cell-gpu').classList.remove('alert');
    }

    if (m.HasBattery) {
      setCell('bat', fmtPct(m.BatteryPercent), m.BatteryPercent <= t.BatteryLow);
    } else {
      document.getElementById('val-bat').innerHTML = `<span class="unit">N/A</span>`;
      document.getElementById('cell-bat').classList.remove('alert');
    }
  } catch (e) {
    console.error('GetMetrics error:', e);
  }
}

function startPolling() {
  clearInterval(pollTimer);
  const ms = (cfg?.General?.IntervalSeconds ?? 1) * 1000;
  pollTimer = setInterval(tick, ms);
}

// --- Config ---

async function loadConfig() {
  cfg = await window.go.main.App.GetConfig();
  const g = cfg.General;
  const a = cfg.Alerts;

  const pct = Math.round(g.Opacity * 100);
  document.getElementById('opacitySlider').value = pct;
  document.getElementById('opacityVal').textContent = `${pct}%`;
  document.getElementById('intervalInput').value  = g.IntervalSeconds;
  document.getElementById('alwaysOnTop').checked  = g.AlwaysOnTop;
  document.getElementById('threshCpu').value  = a.CPUPercent;
  document.getElementById('threshRam').value  = a.RAMPercent;
  document.getElementById('threshDisk').value = a.DiskPercent;
  document.getElementById('threshTemp').value = a.CPUTempCelsius;
  document.getElementById('threshBat').value  = a.BatteryLow;

  applyOpacity(g.Opacity);
}

function applyOpacity(v) {
  document.getElementById('app').style.opacity = v;
}

// --- Settings panel ---

const ctxMenu = document.getElementById('ctxMenu');

document.getElementById('settingsBtn').addEventListener('click', e => {
  e.stopPropagation();
  ctxMenu.classList.toggle('hidden');
});

document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

document.getElementById('opacitySlider').addEventListener('input', e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('opacityVal').textContent = `${v}%`;
  applyOpacity(v / 100);
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  cfg.General.Opacity         = parseInt(document.getElementById('opacitySlider').value, 10) / 100;
  cfg.General.IntervalSeconds = parseInt(document.getElementById('intervalInput').value, 10);
  cfg.General.AlwaysOnTop     = document.getElementById('alwaysOnTop').checked;
  cfg.Alerts.CPUPercent       = parseFloat(document.getElementById('threshCpu').value);
  cfg.Alerts.RAMPercent       = parseFloat(document.getElementById('threshRam').value);
  cfg.Alerts.DiskPercent      = parseFloat(document.getElementById('threshDisk').value);
  cfg.Alerts.CPUTempCelsius   = parseFloat(document.getElementById('threshTemp').value);
  cfg.Alerts.BatteryLow       = parseFloat(document.getElementById('threshBat').value);

  await window.go.main.App.SaveConfig(cfg);
  startPolling();
  ctxMenu.classList.add('hidden');
});

document.getElementById('quitBtn').addEventListener('click', () => {
  window.runtime.Quit();
});

// --- Init: Wails injects window.go and window.runtime before DOMContentLoaded ---

window.addEventListener('load', async () => {
  await loadConfig();
  await tick();
  startPolling();
});
