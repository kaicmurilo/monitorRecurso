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
