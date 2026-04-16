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
		CPUPercent: 50,
		RAMPercent: 60,
		Disks:      []collector.DiskInfo{{Path: "/", Label: "Root", Percent: 70}},
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
