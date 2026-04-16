'use strict';

// Wails v2 vanilla: bindings injected at runtime on window.go and window.runtime.

let cfg = null;
let pollTimer = null;
let lastDiskCount = -1; // detect disk count changes

// --- Formatters ---

function fmtPct(v) {
  return `${v.toFixed(0)}<span class="unit">%</span>`;
}

function fmtTemp(v) {
  if (!v || v <= 0) return `<span class="unit">N/A</span>`;
  return `${v.toFixed(0)}<span class="unit">°C</span>`;
}

function fmtGB(gb) {
  if (gb < 1) return `${(gb * 1024).toFixed(0)}<span class="unit">M</span>`;
  return `${gb.toFixed(1)}<span class="unit">G</span>`;
}

function fmtGBPlain(gb) {
  if (gb < 1) return `${(gb * 1024).toFixed(0)}M`;
  return `${gb.toFixed(1)}`;
}

function fmtBytes(bps) {
  if (bps < 0) return `<span class="unit">N/A</span>`;
  if (bps < 1024)         return `${bps.toFixed(0)}<span class="unit">B/s</span>`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)}<span class="unit">K</span>`;
  return `${(bps / (1024 * 1024)).toFixed(1)}<span class="unit">M</span>`;
}

// --- Card helpers ---

function makeCard(id, label, color, withSub) {
  const d = document.createElement('div');
  d.className = 'card no-drag';
  d.id = `cell-${id}`;
  d.style.setProperty('--c', color);
  d.innerHTML =
    `<div class="card-top">` +
      `<span class="card-label">${label}</span>` +
      `<span class="card-val" id="val-${id}">--</span>` +
    `</div>` +
    `<div class="bar"><div class="bar-fill" id="bar-${id}"></div></div>` +
    (withSub ? `<div class="card-sub" id="sub-${id}"></div>` : '');
  return d;
}

function setCard(id, html, isAlert, pct) {
  const val  = document.getElementById(`val-${id}`);
  const cell = document.getElementById(`cell-${id}`);
  const fill = document.getElementById(`bar-${id}`);
  if (!val) return;
  val.innerHTML = html;
  cell.classList.toggle('alert', isAlert);
  if (fill && pct != null) fill.style.width = Math.min(Math.max(pct, 0), 100) + '%';
}

function setSub(id, text) {
  const el = document.getElementById(`sub-${id}`);
  if (el) el.textContent = text;
}

// --- Grid builder ---

function buildGrid(disks) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const v = cfg.Visible;

  if (v.CPU)     grid.appendChild(makeCard('cpu',     'CPU',    '#3b82f6', false));
  if (v.RAM)     grid.appendChild(makeCard('ram',     'RAM',    '#a855f7', true));
  if (v.Swap)    grid.appendChild(makeCard('swap',    'SWAP',   '#7c3aed', true));
  if (v.Temp)    grid.appendChild(makeCard('temp',    'TEMP',   '#f97316', false));
  if (v.NetUp)   grid.appendChild(makeCard('netup',   '↑ UP',   '#22c55e', false));
  if (v.NetDown) grid.appendChild(makeCard('netdown', '↓ DOWN', '#06b6d4', false));
  if (v.GPU)     grid.appendChild(makeCard('gpu',     'GPU',    '#d946ef', false));
  if (v.Battery) grid.appendChild(makeCard('bat',     'BAT',    '#eab308', false));

  if (v.Disk && disks) {
    disks.forEach((d, i) => {
      grid.appendChild(makeCard(`disk-${i}`, d.Label.toUpperCase(), '#10b981', true));
    });
  }

  lastDiskCount = disks ? disks.length : 0;
}

// --- Metric update ---

async function tick() {
  if (!cfg) return;
  try {
    const m = await window.go.main.App.GetMetrics();
    const t = cfg.Alerts;
    const v = cfg.Visible;

    const diskCount = m.Disks ? m.Disks.length : 0;
    if (diskCount !== lastDiskCount) {
      buildGrid(m.Disks);
    }

    if (v.CPU) setCard('cpu', fmtPct(m.CPUPercent), m.CPUPercent >= t.CPUPercent, m.CPUPercent);

    if (v.RAM) {
      setCard('ram', fmtGB(m.RAMUsedGB), m.RAMPercent >= t.RAMPercent, m.RAMPercent);
      setSub('ram', `${fmtGBPlain(m.RAMUsedGB)} / ${fmtGBPlain(m.RAMTotalGB)} GB`);
    }

    if (v.Swap) {
      if (m.HasSwap) {
        setCard('swap', fmtGB(m.SwapUsedGB), false, m.SwapPercent);
        setSub('swap', `${fmtGBPlain(m.SwapUsedGB)} / ${fmtGBPlain(m.SwapTotalGB)} GB`);
      } else {
        setCard('swap', `<span class="unit">N/A</span>`, false, 0);
        setSub('swap', '');
      }
    }

    if (v.Temp) {
      setCard('temp', fmtTemp(m.CPUTempCelsius),
        m.CPUTempCelsius > 0 && m.CPUTempCelsius >= t.CPUTempCelsius,
        m.CPUTempCelsius > 0 ? Math.min(m.CPUTempCelsius, 100) : 0);
    }

    if (v.NetUp)   setCard('netup',   fmtBytes(m.NetUpBytesPerSec),   false, 0);
    if (v.NetDown) setCard('netdown', fmtBytes(m.NetDownBytesPerSec), false, 0);

    if (v.GPU) {
      if (m.HasGPU) {
        setCard('gpu', fmtPct(m.GPUPercent), m.GPUPercent >= t.GPUPercent, m.GPUPercent);
      } else {
        setCard('gpu', `<span class="unit">N/A</span>`, false, 0);
      }
    }

    if (v.Battery) {
      if (m.HasBattery) {
        setCard('bat', fmtPct(m.BatteryPercent), m.BatteryPercent <= t.BatteryLow, m.BatteryPercent);
      } else {
        setCard('bat', `<span class="unit">N/A</span>`, false, 0);
      }
    }

    if (v.Disk && m.Disks) {
      m.Disks.forEach((d, i) => {
        setCard(`disk-${i}`, fmtPct(d.Percent), d.Percent >= t.DiskPercent, d.Percent);
        setSub(`disk-${i}`, `${d.UsedGB.toFixed(1)} / ${d.TotalGB.toFixed(0)} GB`);
      });
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
  const v = cfg.Visible;

  const pct = Math.round(g.Opacity * 100);
  document.getElementById('opacitySlider').value   = pct;
  document.getElementById('opacityVal').textContent = `${pct}%`;
  document.getElementById('intervalInput').value   = g.IntervalSeconds;
  document.getElementById('alwaysOnTop').checked   = g.AlwaysOnTop;

  document.getElementById('visCPU').checked     = v.CPU;
  document.getElementById('visRAM').checked     = v.RAM;
  document.getElementById('visSwap').checked    = v.Swap;
  document.getElementById('visTemp').checked    = v.Temp;
  document.getElementById('visDisk').checked    = v.Disk;
  document.getElementById('visNetUp').checked   = v.NetUp;
  document.getElementById('visNetDown').checked = v.NetDown;
  document.getElementById('visGPU').checked     = v.GPU;
  document.getElementById('visBattery').checked = v.Battery;

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

function openSettings()  { ctxMenu.classList.remove('hidden'); }
function closeSettings() { ctxMenu.classList.add('hidden'); }

document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);

document.getElementById('opacitySlider').addEventListener('input', e => {
  const v = parseInt(e.target.value, 10);
  document.getElementById('opacityVal').textContent = `${v}%`;
  applyOpacity(v / 100);
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  cfg.General.Opacity         = parseInt(document.getElementById('opacitySlider').value, 10) / 100;
  cfg.General.IntervalSeconds = parseInt(document.getElementById('intervalInput').value, 10);
  cfg.General.AlwaysOnTop     = document.getElementById('alwaysOnTop').checked;

  cfg.Visible.CPU     = document.getElementById('visCPU').checked;
  cfg.Visible.RAM     = document.getElementById('visRAM').checked;
  cfg.Visible.Swap    = document.getElementById('visSwap').checked;
  cfg.Visible.Temp    = document.getElementById('visTemp').checked;
  cfg.Visible.Disk    = document.getElementById('visDisk').checked;
  cfg.Visible.NetUp   = document.getElementById('visNetUp').checked;
  cfg.Visible.NetDown = document.getElementById('visNetDown').checked;
  cfg.Visible.GPU     = document.getElementById('visGPU').checked;
  cfg.Visible.Battery = document.getElementById('visBattery').checked;

  cfg.Alerts.CPUPercent     = parseFloat(document.getElementById('threshCpu').value);
  cfg.Alerts.RAMPercent     = parseFloat(document.getElementById('threshRam').value);
  cfg.Alerts.DiskPercent    = parseFloat(document.getElementById('threshDisk').value);
  cfg.Alerts.CPUTempCelsius = parseFloat(document.getElementById('threshTemp').value);
  cfg.Alerts.BatteryLow     = parseFloat(document.getElementById('threshBat').value);

  await window.go.main.App.SaveConfig(cfg);
  lastDiskCount = -1; // force grid rebuild with new visibility
  startPolling();
  closeSettings();
});

document.getElementById('quitBtn').addEventListener('click', () => {
  window.runtime.Quit();
});

// --- Init ---

window.addEventListener('load', async () => {
  await loadConfig();
  // First tick to get disk list before building the grid
  const m = await window.go.main.App.GetMetrics();
  buildGrid(m.Disks);
  await tick();
  startPolling();
});
