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
