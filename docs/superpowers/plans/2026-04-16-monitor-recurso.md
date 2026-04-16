# Monitor de Recursos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform floating desktop resource monitor widget in Go using Wails v2, displaying CPU, RAM, Disk, Network, GPU, Temperature, and Battery metrics in a minimalist dark grid with configurable transparency, drag support, and native OS alert notifications.

**Architecture:** Go backend collects system metrics via gopsutil/v3 every N seconds inside a goroutine loop, exposes them to a Wails-bridged JS frontend via method bindings, and triggers native OS notifications (beeep) when metrics exceed configurable thresholds. The UI is a frameless, always-on-top, draggable HTML/CSS/JS grid with CSS opacity control.

**Tech Stack:** Go 1.21+, Wails v2, gopsutil/v3, distatus/battery, gen2brain/beeep, gopkg.in/yaml.v3, Vanilla JS (no framework)

---

## File Map

| File | Responsibility |
|---|---|
| `main.go` | Wails bootstrap and window options |
| `app.go` | App struct with methods bound to JS: GetMetrics, GetConfig, SaveConfig |
| `internal/config/config.go` | Types + Load/Save ~/.monitorrecurso/config.yaml |
| `internal/config/config_test.go` | Tests: defaults, save/load roundtrip, auto-create on missing |
| `internal/collector/collector.go` | Collect all metrics; Metrics struct (no raw state exposed) |
| `internal/collector/collector_test.go` | Tests: field ranges, two-call network delta |
| `internal/alert/alert.go` | Engine: threshold check + cooldown + beeep notification |
| `internal/alert/alert_test.go` | Tests: no-alert below threshold, alert fires, cooldown blocks, cooldown expires |
| `frontend/index.html` | Widget HTML: 2×4 grid + context menu |
| `frontend/style.css` | Dark theme, grid layout, alert state, drag region |
| `frontend/main.js` | Polling loop, DOM updates, opacity, context menu, save config |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `main.go`, `app.go`, `go.mod`, `wails.json`, `frontend/` (via wails init)

- [ ] **Step 1: Install Wails CLI**

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails version
```
Expected output: `Wails CLI v2.x.x`

- [ ] **Step 2: Initialize project**

```bash
cd /Users/kaicmurilo/Documents/monitorRecurso
wails init -n monitorRecurso -t vanilla
```

Creates: `main.go`, `app.go`, `wails.json`, `go.mod`, `frontend/index.html`, `frontend/style.css`, `frontend/main.js`

- [ ] **Step 3: Add dependencies**

```bash
go get github.com/shirou/gopsutil/v3@latest
go get github.com/distatus/battery@latest
go get github.com/gen2brain/beeep@latest
go get gopkg.in/yaml.v3@latest
go mod tidy
```

- [ ] **Step 4: Create internal package directories**

```bash
mkdir -p internal/config internal/collector internal/alert
```

- [ ] **Step 5: Verify default build compiles**

```bash
wails build
```
Expected: binary produced in `build/bin/`. No errors.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Wails v2 project with all dependencies"
```

---

### Task 2: Config Module

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/config/config_test.go`

- [ ] **Step 1: Write failing tests**

Create `internal/config/config_test.go`:

```go
package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"monitorRecurso/internal/config"
)

func TestDefaultConfig(t *testing.T) {
	cfg := config.DefaultConfig()
	if cfg.General.IntervalSeconds != 1 {
		t.Errorf("expected IntervalSeconds=1, got %d", cfg.General.IntervalSeconds)
	}
	if cfg.General.Opacity != 0.85 {
		t.Errorf("expected Opacity=0.85, got %f", cfg.General.Opacity)
	}
	if !cfg.General.AlwaysOnTop {
		t.Error("expected AlwaysOnTop=true")
	}
	if cfg.Alerts.CPUPercent != 90 {
		t.Errorf("expected CPUPercent=90, got %f", cfg.Alerts.CPUPercent)
	}
	if cfg.Alerts.RAMPercent != 85 {
		t.Errorf("expected RAMPercent=85, got %f", cfg.Alerts.RAMPercent)
	}
	if cfg.Alerts.CooldownSeconds != 60 {
		t.Errorf("expected CooldownSeconds=60, got %d", cfg.Alerts.CooldownSeconds)
	}
	if cfg.Alerts.BatteryLow != 15 {
		t.Errorf("expected BatteryLow=15, got %f", cfg.Alerts.BatteryLow)
	}
}

func TestSaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	cfg := config.DefaultConfig()
	cfg.General.Opacity = 0.5
	cfg.Alerts.CPUPercent = 75

	if err := config.Save(cfg); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := config.Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if loaded.General.Opacity != 0.5 {
		t.Errorf("expected Opacity=0.5, got %f", loaded.General.Opacity)
	}
	if loaded.Alerts.CPUPercent != 75 {
		t.Errorf("expected CPUPercent=75, got %f", loaded.Alerts.CPUPercent)
	}
}

func TestLoadCreatesDefaultWhenMissing(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if cfg.General.IntervalSeconds != 1 {
		t.Errorf("expected default IntervalSeconds=1, got %d", cfg.General.IntervalSeconds)
	}

	path := filepath.Join(tmpDir, ".monitorrecurso", "config.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("expected config file to be created on missing")
	}
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
go test ./internal/config/... -v
```
Expected: FAIL — package does not exist yet

- [ ] **Step 3: Implement config.go**

Create `internal/config/config.go`:

```go
package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Position struct {
	X int `yaml:"x"`
	Y int `yaml:"y"`
}

type General struct {
	IntervalSeconds int      `yaml:"interval_seconds"`
	Opacity         float64  `yaml:"opacity"`
	AlwaysOnTop     bool     `yaml:"always_on_top"`
	Position        Position `yaml:"position"`
}

type Alerts struct {
	CooldownSeconds int     `yaml:"cooldown_seconds"`
	CPUPercent      float64 `yaml:"cpu_percent"`
	RAMPercent      float64 `yaml:"ram_percent"`
	DiskPercent     float64 `yaml:"disk_percent"`
	CPUTempCelsius  float64 `yaml:"cpu_temp_celsius"`
	GPUPercent      float64 `yaml:"gpu_percent"`
	BatteryLow      float64 `yaml:"battery_low"`
}

type Config struct {
	General General `yaml:"general"`
	Alerts  Alerts  `yaml:"alerts"`
}

func DefaultConfig() Config {
	return Config{
		General: General{
			IntervalSeconds: 1,
			Opacity:         0.85,
			AlwaysOnTop:     true,
			Position:        Position{X: 50, Y: 50},
		},
		Alerts: Alerts{
			CooldownSeconds: 60,
			CPUPercent:      90,
			RAMPercent:      85,
			DiskPercent:     90,
			CPUTempCelsius:  80,
			GPUPercent:      95,
			BatteryLow:      15,
		},
	}
}

func configPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".monitorrecurso", "config.yaml"), nil
}

func Load() (Config, error) {
	path, err := configPath()
	if err != nil {
		return DefaultConfig(), err
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		cfg := DefaultConfig()
		return cfg, Save(cfg)
	}
	if err != nil {
		return DefaultConfig(), err
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return DefaultConfig(), err
	}
	return cfg, nil
}

func Save(cfg Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
go test ./internal/config/... -v
```
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/config/
git commit -m "feat: add config module with load/save and auto-create defaults"
```

---

### Task 3: Collector Module

**Files:**
- Create: `internal/collector/collector.go`
- Create: `internal/collector/gpu.go`
- Create: `internal/collector/collector_test.go`

- [ ] **Step 1: Write failing tests**

Create `internal/collector/collector_test.go`:

```go
package collector_test

import (
	"testing"

	"monitorRecurso/internal/collector"
)

func TestCollectReturnsValidRanges(t *testing.T) {
	m, err := collector.Collect(0, 0, 0)
	if err != nil {
		t.Fatalf("Collect failed: %v", err)
	}
	if m.CPUPercent < 0 || m.CPUPercent > 100 {
		t.Errorf("CPUPercent out of range: %f", m.CPUPercent)
	}
	if m.RAMPercent < 0 || m.RAMPercent > 100 {
		t.Errorf("RAMPercent out of range: %f", m.RAMPercent)
	}
	if m.DiskPercent < 0 || m.DiskPercent > 100 {
		t.Errorf("DiskPercent out of range: %f", m.DiskPercent)
	}
	if m.NetUpBytesPerSec < 0 {
		t.Error("NetUpBytesPerSec should not be negative")
	}
	if m.NetDownBytesPerSec < 0 {
		t.Error("NetDownBytesPerSec should not be negative")
	}
}

func TestCollectTwiceGivesNetworkDelta(t *testing.T) {
	m1, err := collector.Collect(0, 0, 0)
	if err != nil {
		t.Fatalf("first Collect failed: %v", err)
	}
	m2, err := collector.Collect(m1.RawSent, m1.RawRecv, m1.RawTime)
	if err != nil {
		t.Fatalf("second Collect failed: %v", err)
	}
	if m2.NetUpBytesPerSec < 0 || m2.NetDownBytesPerSec < 0 {
		t.Error("network bytes/sec should not be negative after two calls")
	}
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
go test ./internal/collector/... -v
```
Expected: FAIL — package does not exist

- [ ] **Step 3: Implement collector.go**

Create `internal/collector/collector.go`:

```go
package collector

import (
	"time"

	bat "github.com/distatus/battery"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"
)

// Metrics holds one snapshot of all system metrics.
// RawSent, RawRecv, RawTime are opaque state for the next Collect call — not sent to JS.
type Metrics struct {
	CPUPercent         float64
	RAMPercent         float64
	DiskPercent        float64
	CPUTempCelsius     float64
	NetUpBytesPerSec   float64
	NetDownBytesPerSec float64
	GPUPercent         float64 // -1 if unavailable
	BatteryPercent     float64 // -1 if no battery
	HasGPU             bool
	HasBattery         bool

	// Internal state — passed back to next Collect call; not exposed to JS.
	RawSent uint64
	RawRecv uint64
	RawTime int64 // UnixNano
}

// Collect gathers all system metrics.
// Pass rawSent=0, rawRecv=0, rawTime=0 on the first call.
func Collect(prevSent, prevRecv uint64, prevTimeNano int64) (Metrics, error) {
	var m Metrics

	// CPU (200ms sample)
	percents, err := cpu.Percent(200*time.Millisecond, false)
	if err == nil && len(percents) > 0 {
		m.CPUPercent = percents[0]
	}

	// RAM
	vm, err := mem.VirtualMemory()
	if err == nil {
		m.RAMPercent = vm.UsedPercent
	}

	// Disk (root partition)
	du, err := disk.Usage("/")
	if err == nil {
		m.DiskPercent = du.UsedPercent
	}

	// CPU Temperature (best-effort)
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			if t.Temperature > 0 {
				m.CPUTempCelsius = t.Temperature
				break
			}
		}
	}

	// Network
	netStats, err := gnet.IOCounters(false)
	now := time.Now()
	if err == nil && len(netStats) > 0 {
		sent := netStats[0].BytesSent
		recv := netStats[0].BytesRecv
		if prevTimeNano > 0 {
			elapsed := now.Sub(time.Unix(0, prevTimeNano)).Seconds()
			if elapsed > 0 {
				m.NetUpBytesPerSec = float64(sent-prevSent) / elapsed
				m.NetDownBytesPerSec = float64(recv-prevRecv) / elapsed
			}
		}
		m.RawSent = sent
		m.RawRecv = recv
		m.RawTime = now.UnixNano()
	}

	// GPU (platform-specific stub — see gpu.go)
	m.GPUPercent = collectGPU()
	m.HasGPU = m.GPUPercent >= 0

	// Battery
	m.BatteryPercent = -1
	batteries, err := bat.GetAll()
	if err == nil && len(batteries) > 0 {
		b := batteries[0]
		if b.Full > 0 {
			m.BatteryPercent = (b.Current / b.Full) * 100
			m.HasBattery = true
		}
	}

	return m, nil
}
```

- [ ] **Step 4: Create GPU stub**

Create `internal/collector/gpu.go`:

```go
package collector

// collectGPU returns the GPU utilization percentage, or -1 if unavailable.
// To add real GPU support:
//   - NVIDIA (Linux/Windows): import github.com/NVIDIA/go-nvml and call nvml.DeviceGetUtilizationRates
//   - macOS: use CGo with IOKit or parse `powermetrics` output
func collectGPU() float64 {
	return -1
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
go test ./internal/collector/... -v
```
Expected: All 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add internal/collector/
git commit -m "feat: add collector module for all system metrics via gopsutil"
```

---

### Task 4: Alert Engine

**Files:**
- Create: `internal/alert/alert.go`
- Create: `internal/alert/alert_test.go`

- [ ] **Step 1: Write failing tests**

Create `internal/alert/alert_test.go`:

```go
package alert_test

import (
	"testing"
	"time"

	"monitorRecurso/internal/alert"
	"monitorRecurso/internal/collector"
	"monitorRecurso/internal/config"
)

func defaultEngine() *alert.Engine {
	return alert.NewEngine(config.DefaultConfig().Alerts)
}

func TestNoAlertBelowThreshold(t *testing.T) {
	e := defaultEngine()
	fired := e.Check(collector.Metrics{
		CPUPercent:  50,
		RAMPercent:  60,
		DiskPercent: 70,
	})
	if len(fired) != 0 {
		t.Errorf("expected no alerts, got %v", fired)
	}
}

func TestCPUAlertAboveThreshold(t *testing.T) {
	e := defaultEngine()
	fired := e.Check(collector.Metrics{CPUPercent: 95})
	found := false
	for _, a := range fired {
		if a.Metric == "CPU" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected CPU alert, got %v", fired)
	}
}

func TestCooldownPreventsRepeat(t *testing.T) {
	e := defaultEngine() // cooldown=60s
	high := collector.Metrics{CPUPercent: 95}

	first := e.Check(high)
	if len(first) == 0 {
		t.Fatal("first check should fire alert")
	}

	second := e.Check(high)
	if len(second) != 0 {
		t.Error("second check within cooldown should not fire")
	}
}

func TestCooldownExpiry(t *testing.T) {
	cfg := config.DefaultConfig()
	cfg.Alerts.CooldownSeconds = 60
	e := alert.NewEngine(cfg.Alerts)

	high := collector.Metrics{CPUPercent: 95}
	e.Check(high)

	// Simulate cooldown expired
	e.ForceExpireCooldown("CPU", time.Now().Add(-61*time.Second))

	fired := e.Check(high)
	if len(fired) == 0 {
		t.Error("expected alert to fire again after cooldown expires")
	}
}

func TestBatteryLowAlert(t *testing.T) {
	e := defaultEngine()
	fired := e.Check(collector.Metrics{
		BatteryPercent: 10,
		HasBattery:     true,
	})
	found := false
	for _, a := range fired {
		if a.Metric == "Battery" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected Battery alert, got %v", fired)
	}
}

func TestBatteryAlertSkippedWithoutBattery(t *testing.T) {
	e := defaultEngine()
	fired := e.Check(collector.Metrics{
		BatteryPercent: 5,
		HasBattery:     false,
	})
	for _, a := range fired {
		if a.Metric == "Battery" {
			t.Error("should not alert on battery when HasBattery=false")
		}
	}
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
go test ./internal/alert/... -v
```
Expected: FAIL — package does not exist

- [ ] **Step 3: Implement alert.go**

Create `internal/alert/alert.go`:

```go
package alert

import (
	"fmt"
	"sync"
	"time"

	"github.com/gen2brain/beeep"
	"monitorRecurso/internal/collector"
	"monitorRecurso/internal/config"
)

// Alert describes a notification that fired.
type Alert struct {
	Metric  string
	Message string
}

// Engine checks metrics against thresholds and fires OS notifications with per-metric cooldown.
type Engine struct {
	mu         sync.Mutex
	thresholds config.Alerts
	lastFired  map[string]time.Time
}

func NewEngine(t config.Alerts) *Engine {
	return &Engine{
		thresholds: t,
		lastFired:  make(map[string]time.Time),
	}
}

// UpdateThresholds hot-reloads thresholds without restarting.
func (e *Engine) UpdateThresholds(t config.Alerts) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.thresholds = t
}

// ForceExpireCooldown sets the last-fired time to t for a metric (used in tests).
func (e *Engine) ForceExpireCooldown(metric string, t time.Time) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.lastFired[metric] = t
}

// Check evaluates all metrics, fires OS notifications as needed, and returns fired alerts.
func (e *Engine) Check(m collector.Metrics) []Alert {
	e.mu.Lock()
	defer e.mu.Unlock()

	cooldown := time.Duration(e.thresholds.CooldownSeconds) * time.Second
	var fired []Alert

	fire := func(metric, msg string) {
		fired = append(fired, Alert{Metric: metric, Message: msg})
		_ = beeep.Notify("Monitor de Recursos", msg, "")
		e.lastFired[metric] = time.Now()
	}

	checkHigh := func(metric string, value, threshold float64, msg string) {
		if value >= threshold && time.Since(e.lastFired[metric]) > cooldown {
			fire(metric, msg)
		}
	}

	checkLow := func(metric string, value, threshold float64, msg string, active bool) {
		if active && value <= threshold && time.Since(e.lastFired[metric]) > cooldown {
			fire(metric, msg)
		}
	}

	checkHigh("CPU", m.CPUPercent, e.thresholds.CPUPercent,
		fmt.Sprintf("CPU em %.0f%% — limite: %.0f%%", m.CPUPercent, e.thresholds.CPUPercent))
	checkHigh("RAM", m.RAMPercent, e.thresholds.RAMPercent,
		fmt.Sprintf("RAM em %.0f%% — limite: %.0f%%", m.RAMPercent, e.thresholds.RAMPercent))
	checkHigh("Disk", m.DiskPercent, e.thresholds.DiskPercent,
		fmt.Sprintf("Disco em %.0f%% — limite: %.0f%%", m.DiskPercent, e.thresholds.DiskPercent))
	checkHigh("CPUTemp", m.CPUTempCelsius, e.thresholds.CPUTempCelsius,
		fmt.Sprintf("Temp CPU em %.0f°C — limite: %.0f°C", m.CPUTempCelsius, e.thresholds.CPUTempCelsius))
	if m.HasGPU {
		checkHigh("GPU", m.GPUPercent, e.thresholds.GPUPercent,
			fmt.Sprintf("GPU em %.0f%% — limite: %.0f%%", m.GPUPercent, e.thresholds.GPUPercent))
	}
	checkLow("Battery", m.BatteryPercent, e.thresholds.BatteryLow,
		fmt.Sprintf("Bateria em %.0f%% — limite: %.0f%%", m.BatteryPercent, e.thresholds.BatteryLow),
		m.HasBattery)

	return fired
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
go test ./internal/alert/... -v
```
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add internal/alert/
git commit -m "feat: add alert engine with per-metric cooldown and beeep notifications"
```

---

### Task 5: Wails App Bridge

**Files:**
- Replace: `app.go`

- [ ] **Step 1: Replace the generated app.go**

Replace the entire contents of `app.go` with:

```go
package main

import (
	"context"
	"sync"
	"time"

	"monitorRecurso/internal/alert"
	"monitorRecurso/internal/collector"
	"monitorRecurso/internal/config"
)

// App is the Wails application struct. All exported methods are bound to JS.
type App struct {
	ctx    context.Context
	mu     sync.RWMutex
	latest collector.Metrics
	cfg    config.Config
	engine *alert.Engine
}

func NewApp() *App {
	cfg, _ := config.Load()
	return &App{
		cfg:    cfg,
		engine: alert.NewEngine(cfg.Alerts),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go a.collectLoop()
}

func (a *App) collectLoop() {
	var (
		prevSent     uint64
		prevRecv     uint64
		prevTimeNano int64
	)
	for {
		a.mu.RLock()
		interval := time.Duration(a.cfg.General.IntervalSeconds) * time.Second
		a.mu.RUnlock()

		time.Sleep(interval)

		m, err := collector.Collect(prevSent, prevRecv, prevTimeNano)
		if err != nil {
			continue
		}
		prevSent = m.RawSent
		prevRecv = m.RawRecv
		prevTimeNano = m.RawTime

		a.mu.Lock()
		a.latest = m
		a.mu.Unlock()

		a.engine.Check(m)
	}
}

// GetMetrics returns the latest metrics snapshot. Called by JS every tick.
func (a *App) GetMetrics() collector.Metrics {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.latest
}

// GetConfig returns the current configuration to populate the context menu.
func (a *App) GetConfig() config.Config {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.cfg
}

// SaveConfig persists new settings and hot-reloads thresholds and interval.
func (a *App) SaveConfig(cfg config.Config) error {
	a.mu.Lock()
	a.cfg = cfg
	a.engine.UpdateThresholds(cfg.Alerts)
	a.mu.Unlock()
	return config.Save(cfg)
}
```

- [ ] **Step 2: Verify the whole project compiles**

```bash
go build ./...
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app.go
git commit -m "feat: implement Wails app bridge — GetMetrics, GetConfig, SaveConfig"
```

---

### Task 6: Main Entry Point — Window Options

**Files:**
- Replace: `main.go`

- [ ] **Step 1: Replace the generated main.go**

Replace the entire contents of `main.go` with:

```go
package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"monitorRecurso/internal/config"
)

//go:embed all:frontend
var assets embed.FS

func main() {
	cfg, _ := config.Load()
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "Monitor de Recursos",
		Width:            220,
		Height:           270,
		MinWidth:         180,
		MinHeight:        220,
		Frameless:        true,
		AlwaysOnTop:      cfg.General.AlwaysOnTop,
		BackgroundColour: &options.RGBA{R: 26, G: 26, B: 46, A: 210},
		DisableResize:    true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		},
		Linux: &linux.Options{
			WindowIsTranslucent: true,
		},
	})
	if err != nil {
		panic(err)
	}
}
```

- [ ] **Step 2: Build**

```bash
wails build
```
Expected: binary in `build/bin/`. No errors.

- [ ] **Step 3: Commit**

```bash
git add main.go
git commit -m "feat: configure frameless always-on-top transparent window via Wails"
```

---

### Task 7: Frontend HTML

**Files:**
- Replace: `frontend/index.html`

- [ ] **Step 1: Replace frontend/index.html**

Replace the entire contents of `frontend/index.html` with:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monitor de Recursos</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div id="app" class="drag-region">
    <div class="header">
      <span class="title">SYS MONITOR</span>
      <span class="settings-btn no-drag" id="settingsBtn" title="Configurações">⚙</span>
    </div>

    <div class="grid">
      <div class="cell" id="cell-cpu">
        <div class="value" id="val-cpu">--</div>
        <div class="label">CPU</div>
      </div>
      <div class="cell" id="cell-ram">
        <div class="value" id="val-ram">--</div>
        <div class="label">RAM</div>
      </div>
      <div class="cell" id="cell-temp">
        <div class="value" id="val-temp">--</div>
        <div class="label">TEMP</div>
      </div>
      <div class="cell" id="cell-disk">
        <div class="value" id="val-disk">--</div>
        <div class="label">DISK</div>
      </div>
      <div class="cell" id="cell-netup">
        <div class="value net-up" id="val-netup">--</div>
        <div class="label">NET ↑</div>
      </div>
      <div class="cell" id="cell-netdown">
        <div class="value net-down" id="val-netdown">--</div>
        <div class="label">NET ↓</div>
      </div>
      <div class="cell" id="cell-gpu">
        <div class="value" id="val-gpu">--</div>
        <div class="label">GPU</div>
      </div>
      <div class="cell" id="cell-bat">
        <div class="value" id="val-bat">--</div>
        <div class="label">BAT</div>
      </div>
    </div>
  </div>

  <!-- Context menu (settings panel) -->
  <div id="ctxMenu" class="ctx-menu hidden" onclick="event.stopPropagation()">
    <div class="ctx-row">
      <label>Opacidade</label>
      <input type="range" id="opacitySlider" min="10" max="100" value="85" />
      <span id="opacityVal">85%</span>
    </div>
    <div class="ctx-row">
      <label>Intervalo (s)</label>
      <input type="number" id="intervalInput" min="1" max="60" value="1" style="width:50px" />
    </div>
    <div class="ctx-row">
      <label>Sempre no topo</label>
      <input type="checkbox" id="alwaysOnTop" checked />
    </div>
    <div class="ctx-sep"></div>
    <div class="ctx-section">Limites de alerta</div>
    <div class="ctx-row"><label>CPU %</label>   <input type="number" id="threshCpu"  min="1" max="100" value="90" /></div>
    <div class="ctx-row"><label>RAM %</label>   <input type="number" id="threshRam"  min="1" max="100" value="85" /></div>
    <div class="ctx-row"><label>Disco %</label> <input type="number" id="threshDisk" min="1" max="100" value="90" /></div>
    <div class="ctx-row"><label>Temp °C</label> <input type="number" id="threshTemp" min="1" max="120" value="80" /></div>
    <div class="ctx-row"><label>Bat %</label>   <input type="number" id="threshBat"  min="1" max="50"  value="15" /></div>
    <div class="ctx-sep"></div>
    <div class="ctx-btn" id="saveBtn">Salvar</div>
    <div class="ctx-btn ctx-quit" id="quitBtn">Fechar app</div>
  </div>

  <script src="/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat: add widget HTML — 2x4 metric grid and settings panel"
```

---

### Task 8: Frontend CSS

**Files:**
- Replace: `frontend/style.css`

- [ ] **Step 1: Replace frontend/style.css**

Replace the entire contents of `frontend/style.css` with:

```css
:root {
  --bg: rgba(26, 26, 46, 0.92);
  --accent: #e94560;
  --text: #ffffff;
  --muted: #a8a8b3;
  --net-up: #3fb950;
  --net-down: #58a6ff;
  --alert-bg: rgba(233, 69, 96, 0.15);
  --alert-text: #e94560;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: transparent;
  font-family: 'Courier New', Courier, monospace;
  -webkit-user-select: none;
  user-select: none;
  overflow: hidden;
}

/* Wails drag region via CSS custom property */
.drag-region  { --wails-draggable: drag; }
.no-drag      { --wails-draggable: no-drag; }

#app {
  background: var(--bg);
  border-radius: 10px;
  padding: 12px 16px 14px;
  border-left: 3px solid var(--accent);
  min-height: 100vh;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.title {
  color: var(--accent);
  font-size: 8px;
  letter-spacing: 2px;
}
.settings-btn {
  color: #555;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0 2px;
}
.settings-btn:hover { color: var(--muted); }

/* Metrics grid */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cell {
  text-align: center;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.3s;
}
.cell.alert { background: var(--alert-bg); }

.value {
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}
.value .unit {
  font-size: 9px;
  color: var(--muted);
  font-weight: 400;
}
.value.net-up   { color: var(--net-up);   font-size: 13px; }
.value.net-down { color: var(--net-down); font-size: 13px; }
.cell.alert .value { color: var(--alert-text); }

.label {
  color: var(--muted);
  font-size: 7px;
  letter-spacing: 1px;
  margin-top: 2px;
}
.cell.alert .label { color: var(--alert-text); }

/* Context menu / settings panel */
.ctx-menu {
  position: fixed;
  top: 8px;
  right: 8px;
  background: #0f0f1e;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 10px 12px;
  z-index: 1000;
  min-width: 210px;
  font-size: 11px;
  color: var(--muted);
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
}
.ctx-menu.hidden { display: none; }

.ctx-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  gap: 8px;
}
.ctx-row label { flex: 1; }
.ctx-row input[type="range"] { flex: 1; accent-color: var(--accent); }
.ctx-row input[type="number"] {
  width: 52px;
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  color: var(--text);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: inherit;
  text-align: right;
}
.ctx-section {
  color: #444;
  font-size: 9px;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: center;
  padding: 2px 0;
}
.ctx-sep { border-top: 1px solid #1e1e2e; margin: 6px 0; }
.ctx-btn {
  text-align: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  color: var(--text);
  transition: background 0.2s;
  margin-top: 4px;
}
.ctx-btn:hover { background: #1a1a2e; }
.ctx-quit { color: var(--accent); }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/style.css
git commit -m "feat: add dark minimalist CSS with alert states and settings panel"
```

---

### Task 9: Frontend JavaScript

**Files:**
- Replace: `frontend/main.js`

- [ ] **Step 1: Build once first to generate Wails JS bindings**

```bash
wails build
```

This generates `frontend/wailsjs/go/main/App.js` and `frontend/wailsjs/runtime/runtime.js`.

- [ ] **Step 2: Replace frontend/main.js**

Replace the entire contents of `frontend/main.js` with:

```javascript
'use strict';

// Wails v2 vanilla: bindings are on window.go, runtime on window.runtime
const { GetMetrics, GetConfig, SaveConfig } = window.go.main.App;
const { Quit } = window.runtime;

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
  if (bps < 1024)           return `${bps.toFixed(0)}<span class="unit">B/s</span>`;
  if (bps < 1024 * 1024)   return `${(bps / 1024).toFixed(1)}<span class="unit">K</span>`;
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
    const m = await GetMetrics();
    const t = cfg.Alerts;

    setCell('cpu',     fmtPct(m.CPUPercent),          m.CPUPercent  >= t.CPUPercent);
    setCell('ram',     fmtPct(m.RAMPercent),          m.RAMPercent  >= t.RAMPercent);
    setCell('temp',    fmtTemp(m.CPUTempCelsius),     m.CPUTempCelsius > 0 && m.CPUTempCelsius >= t.CPUTempCelsius);
    setCell('disk',    fmtPct(m.DiskPercent),         m.DiskPercent >= t.DiskPercent);
    setCell('netup',   fmtBytes(m.NetUpBytesPerSec),  false);
    setCell('netdown', fmtBytes(m.NetDownBytesPerSec),false);

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
  cfg = await GetConfig();
  const g = cfg.General;
  const a = cfg.Alerts;

  const pct = Math.round(g.Opacity * 100);
  document.getElementById('opacitySlider').value = pct;
  document.getElementById('opacityVal').textContent = `${pct}%`;
  document.getElementById('intervalInput').value   = g.IntervalSeconds;
  document.getElementById('alwaysOnTop').checked   = g.AlwaysOnTop;
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

  await SaveConfig(cfg);
  startPolling(); // restart with potentially new interval
  ctxMenu.classList.add('hidden');
});

document.getElementById('quitBtn').addEventListener('click', () => Quit());

// --- Init ---

(async () => {
  await loadConfig();
  await tick();
  startPolling();
})();
```

- [ ] **Step 3: Test in dev mode**

```bash
wails dev
```
Expected: widget window appears. Grid shows live metrics updating every second. Click ⚙ opens settings panel. No JS console errors.

Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add frontend/main.js
git commit -m "feat: add JS polling loop, metric rendering, and settings panel logic"
```

---

### Task 10: Final Integration & Release Build

**Files:** No new files.

- [ ] **Step 1: Run all Go tests**

```bash
go test ./... -v
```
Expected: all tests PASS. Zero failures.

- [ ] **Step 2: Clean release build**

```bash
wails build -clean
```
Expected: binary at `build/bin/monitorRecurso` (Linux/Mac) or `build/bin/monitorRecurso.exe` (Windows)

- [ ] **Step 3: Smoke test the binary**

```bash
./build/bin/monitorRecurso
```
Verify:
- Widget appears on screen, floats over other windows
- All 8 metric cells update every second
- CPU/RAM/etc. values look plausible
- ⚙ button opens settings panel
- Drag the widget to a new position — it stays there
- Adjust opacity slider — widget fades accordingly
- Close via "Fechar app"

- [ ] **Step 4: Verify config file written**

```bash
cat ~/.monitorrecurso/config.yaml
```
Expected: valid YAML with all fields populated.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete resource monitor — all metrics, alerts, transparent draggable widget"
```

---

## Platform Notes

| Feature | macOS | Linux | Windows |
|---|---|---|---|
| Transparency | `WebviewIsTransparent` + `WindowIsTranslucent` | Requires compositor (e.g., Mutter, KWin) | `WebviewIsTransparent` |
| CPU Temp | May need `sudo` on Apple Silicon; returns 0 if blocked | `/sys/class/thermal/` via gopsutil | WMI via gopsutil (auto) |
| GPU stats | Stub (N/A) — extend `internal/collector/gpu.go` with IOKit | Stub — extend with `go-nvml` for NVIDIA | Stub — extend with `go-nvml` or WMI |
| Notifications | `beeep` → NSUserNotification | `beeep` → libnotify (install `libnotify-bin`) | `beeep` → WinToast |
| Battery | `distatus/battery` → IOKit | `distatus/battery` → `/sys/class/power_supply/` | `distatus/battery` → WMI |
