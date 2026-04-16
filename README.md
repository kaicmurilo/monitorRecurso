# Monitor de Recursos

Widget flutuante de monitoramento do sistema — CPU, RAM, Disco, Rede, GPU, Temperatura e Bateria. Sempre visível, transparente, arrastável, com alertas nativos do OS.

**Stack:** Go + Wails v2 | **Plataformas:** macOS, Linux, Windows

---

## Pré-requisitos

```bash
# Go 1.21+
go version

# Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# macOS: Xcode Command Line Tools
xcode-select --install

# Linux: dependências do WebKitGTK
# Ubuntu/Debian:
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev

# Windows: WebView2 já vem com Windows 10/11
```

---

## Dev local

```bash
# Clonar e entrar no projeto
cd /Users/kaicmurilo/Documents/monitorRecurso

# Rodar em modo dev (hot-reload do frontend, janela abre automaticamente)
~/go/bin/wails dev
```

No modo dev:
- O widget abre na tela com live-reload ao salvar `frontend/*.{html,css,js}`
- O Go recompila automaticamente ao salvar `*.go`
- Console do WebView disponível em **http://localhost:34115** no navegador

---

## Build de produção

```bash
# Build para a plataforma atual
~/go/bin/wails build

# Build limpo (apaga binários anteriores)
~/go/bin/wails build -clean

# Binário gerado em:
# macOS:   build/bin/monitorRecurso.app
# Linux:   build/bin/monitorRecurso
# Windows: build/bin/monitorRecurso.exe
```

**macOS — abrir o app:**
```bash
open build/bin/monitorRecurso.app
```

**Linux:**
```bash
./build/bin/monitorRecurso
```

---

## Testes

```bash
go test ./... -v
```

---

## Configuração

O arquivo de configuração é criado automaticamente na primeira execução:

```
~/.monitorrecurso/config.yaml
```

```yaml
general:
  interval_seconds: 1     # intervalo de coleta em segundos
  opacity: 0.85           # transparência do widget (0.1 – 1.0)
  always_on_top: true
  position:
    x: 50
    y: 50

alerts:
  cooldown_seconds: 60    # tempo mínimo entre alertas da mesma métrica
  cpu_percent: 90
  ram_percent: 85
  disk_percent: 90
  cpu_temp_celsius: 80
  gpu_percent: 95
  battery_low: 15
```

Os limites também podem ser ajustados em tempo real pelo painel **⚙** no widget.

---

## Estrutura do projeto

```
monitorRecurso/
├── main.go                   # entry point Wails, opções da janela
├── app.go                    # bridge Go ↔ JS (GetMetrics, GetConfig, SaveConfig)
├── internal/
│   ├── collector/collector.go # coleta métricas via gopsutil
│   ├── alert/alert.go         # engine de alertas com cooldown
│   └── config/config.go       # load/save config.yaml
└── frontend/
    ├── index.html             # grid 2×4 + painel de configurações
    ├── style.css              # tema escuro minimalista
    └── main.js                # polling, formatação, controles
```
