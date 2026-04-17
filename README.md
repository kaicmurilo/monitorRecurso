# Monitor de Recursos

Widget flutuante de monitoramento do sistema — CPU, RAM, Disco, Rede, GPU, Temperatura e Bateria. Sempre visível, transparente, arrastável, com alertas nativos do OS.

**Stack:** Go + Wails v2 | **Plataformas:** macOS, Linux, Windows

---

## Instalação via npm (usuário final)

Não requer Go, Wails ou qualquer dependência de build. O binário é baixado automaticamente do GitHub Releases.

```bash
npm install -g monitor-recurso
```

### Usar

```bash
monitor-recurso start                # inicia o widget em background
monitor-recurso stop                 # para o widget
monitor-recurso reload               # reinicia
monitor-recurso status               # verifica se está rodando
monitor-recurso autostart enable     # inicia automaticamente com o sistema
monitor-recurso autostart disable    # remove inicialização automática
```

---

## Desenvolvimento local

### Pré-requisitos

```bash
# Go 1.21+
go version

# Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# macOS: Xcode Command Line Tools
xcode-select --install

# Linux: dependências do WebKitGTK
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev

# Windows: WebView2 já vem com Windows 10/11
```

### Dev (hot-reload)

```bash
~/go/bin/wails dev
```

- Widget abre com live-reload ao salvar `frontend/*.{html,css,js}`
- Go recompila automaticamente ao salvar `*.go`
- Console do WebView disponível em **http://localhost:34115**

### Build de produção

```bash
~/go/bin/wails build -clean

# Binário gerado em:
# macOS:   build/bin/monitorRecurso.app
# Linux:   build/bin/monitorRecurso
# Windows: build/bin/monitorRecurso.exe
```

---

## Publicar nova versão

O CI (GitHub Actions) builda os binários para todas as plataformas e cria o GitHub Release automaticamente ao fazer push de uma tag.

```bash
# 1. Atualizar version em package.json
# 2. Criar e subir a tag
git tag v1.0.2
git push origin v1.0.2

# 3. Após o CI terminar, publicar no npm
npm publish
```

---

## Configuração

Criado automaticamente em `~/.monitorrecurso/config.yaml` na primeira execução:

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
├── main.go                    # entry point Wails, opções da janela
├── app.go                     # bridge Go ↔ JS (GetMetrics, GetConfig, SaveConfig)
├── internal/
│   ├── collector/collector.go  # coleta métricas via gopsutil
│   ├── alert/alert.go          # engine de alertas com cooldown
│   └── config/config.go        # load/save config.yaml
├── frontend/
│   ├── index.html              # grid 2×4 + painel de configurações
│   ├── style.css               # tema escuro minimalista
│   └── main.js                 # polling, formatação, controles
├── bin/cli.js                  # CLI npm (start/stop/reload/status/autostart)
└── scripts/postinstall.js      # download automático do binário no npm install
```
