package main

import (
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"monitorRecurso/internal/config"
	"monitorRecurso/internal/singleinstance"
)

//go:embed all:frontend
var assets embed.FS

func pidPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".monitorrecurso", "app.pid")
}

func writePID() {
	p := pidPath()
	_ = os.MkdirAll(filepath.Dir(p), 0755)
	_ = os.WriteFile(p, []byte(strconv.Itoa(os.Getpid())), 0644)
}

func removePID() { _ = os.Remove(pidPath()) }

func main() {
	// Single instance — exit cleanly if already running
	release, ok := singleinstance.Acquire()
	if !ok {
		fmt.Fprintln(os.Stderr, "monitor-recurso: already running")
		os.Exit(0)
	}
	defer release()

	writePID()
	defer removePID()

	cfg, err := config.Load()
	if err != nil {
		log.Printf("warning: could not load config: %v — using defaults", err)
	}
	app := NewApp(cfg)

	err = wails.Run(&options.App{
		Title:            "Monitor de Recursos",
		Width:            220,
		Height:           280,
		MinWidth:         180,
		MinHeight:        240,
		Frameless:        true,
		AlwaysOnTop:      false,
		BackgroundColour: &options.RGBA{R: 11, G: 11, B: 17, A: 237},
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
