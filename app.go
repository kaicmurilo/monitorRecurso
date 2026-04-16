package main

import (
	"context"
	"sync"
	"time"

	"monitorRecurso/internal/alert"
	"monitorRecurso/internal/collector"
	"monitorRecurso/internal/config"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the Wails application struct. All exported methods are bound to JS.
type App struct {
	ctx    context.Context
	mu     sync.RWMutex
	latest collector.Metrics
	cfg    config.Config
	engine *alert.Engine
}

func NewApp(cfg config.Config) *App {
	return &App{
		cfg:    cfg,
		engine: alert.NewEngine(cfg.Alerts),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	runtime.WindowSetAlwaysOnTop(ctx, a.cfg.General.AlwaysOnTop)
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

		select {
		case <-a.ctx.Done():
			return
		case <-time.After(interval):
		}

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
	runtime.WindowSetAlwaysOnTop(a.ctx, cfg.General.AlwaysOnTop)
	return config.Save(cfg)
}
