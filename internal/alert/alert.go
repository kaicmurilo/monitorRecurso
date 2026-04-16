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

// Check evaluates all metrics, fires OS notifications as needed, and returns fired alerts.
func (e *Engine) Check(m collector.Metrics) []Alert {
	e.mu.Lock()

	cooldown := time.Duration(e.thresholds.CooldownSeconds) * time.Second
	var fired []Alert
	var notifications []string // collected while locked, dispatched after unlock

	fire := func(metric, msg string) {
		fired = append(fired, Alert{Metric: metric, Message: msg})
		notifications = append(notifications, msg)
		e.lastFired[metric] = time.Now()
	}

	checkHigh := func(metric string, value, threshold float64, msg string) {
		if value >= threshold && time.Since(e.lastFired[metric]) > cooldown {
			fire(metric, msg)
		}
	}

	// checkLow fires when value is at or below the threshold (e.g. battery low)
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

	e.mu.Unlock()

	// Dispatch OS notifications after releasing the lock to avoid blocking concurrent callers
	for _, msg := range notifications {
		_ = beeep.Notify("Monitor de Recursos", msg, "")
	}

	return fired
}
