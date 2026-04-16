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
