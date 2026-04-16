# Monitor de Recursos — Design Spec

**Data:** 2026-04-16
**Stack:** Go + Wails v2 + HTML/CSS/JS
**Plataformas:** macOS, Linux, Windows

---

## 1. Visão Geral

Widget flutuante de monitoramento de recursos do sistema que fica na área de trabalho sem interferir na navegação. Sempre visível, arrastável, com transparência configurável e alertas via notificação nativa do OS quando métricas ultrapassam limites críticos.

---

## 2. Métricas Monitoradas

| Métrica | Fonte | Nota |
|---|---|---|
| CPU % | gopsutil/v3 | média de todos os cores |
| RAM % | gopsutil/v3 | usado / total |
| Temperatura CPU | gopsutil/v3 | fallback gracioso se não disponível |
| Disco % | gopsutil/v3 | partição raiz por padrão |
| Rede ↑ / ↓ | gopsutil/v3 | bytes/s em tempo real |
| GPU % | nvml (Linux/Win) / IOKit CGo (Mac) | fallback gracioso se sem GPU ou driver |
| Bateria % | gopsutil/v3 | oculto em desktops sem bateria |

Intervalo de coleta: **1 segundo** (configurável).

---

## 3. Arquitetura

```
Collector (Go)  →  Alert Engine (Go)  →  Notificação nativa OS
      ↓
   app.go (Wails bridge)
      ↓
  Frontend JS (atualiza grid a cada tick)
```

### 3.1 Componentes

**`internal/collector/collector.go`**
- Usa `gopsutil/v3` para coletar todas as métricas num loop com ticker
- Expõe struct `Metrics` com todos os campos
- GPU: tenta `nvml` (NVIDIA) / `IOKit` (Apple); zera o campo se indisponível

**`internal/alert/alert.go`**
- Recebe `Metrics` a cada tick
- Compara contra thresholds do config
- Cooldown por métrica (padrão 60s) para evitar spam de notificações
- Dispara notificação nativa via `gen2brain/beeep`

**`internal/config/config.go`**
- Load/save de `~/.monitorrecurso/config.yaml`
- Cria arquivo com valores padrão na primeira execução
- Salva posição da janela ao mover

**`app.go`**
- Struct principal do Wails
- Método `GetMetrics() Metrics` chamado pelo JS via binding
- Método `SaveConfig(cfg Config)` para persistir mudanças do menu de contexto

**`frontend/`**
- `index.html` + `style.css` + `main.js`
- Grid 2×4 com as 8 métricas
- Polling via `setInterval` (1s) chamando `window.go.main.App.GetMetrics()`
- Célula fica vermelha se métrica está acima do threshold
- Menu de contexto (botão direito) para ajustar opacidade, intervalo e toggle always-on-top

---

## 4. UI / Widget

- **Estilo:** Minimalista Grid — números grandes em grade 2×4, sem barras de progresso
- **Janela:** sem bordas, sempre no topo (`AlwaysOnTop: true`), arrastável
- **Transparência:** configurável via slider no menu de contexto (0.1–1.0), padrão 0.85
- **Estado de alerta:** célula da métrica fica com fundo vermelho + notificação nativa do OS
- **Posição:** salva em `config.yaml` ao soltar o drag

---

## 5. Sistema de Alertas

- Notificação nativa do OS (toast) via `gen2brain/beeep`
- Cooldown por métrica: 60s entre alertas da mesma métrica
- Limites padrão:

| Métrica | Threshold padrão |
|---|---|
| CPU | > 90% |
| RAM | > 85% |
| Disco | > 90% |
| Temp CPU | > 80°C |
| GPU | > 95% |
| Bateria | < 15% |

---

## 6. Configuração

Arquivo: `~/.monitorrecurso/config.yaml`

```yaml
general:
  interval_seconds: 1
  opacity: 0.85        # 0.1 – 1.0
  always_on_top: true
  position:
    x: 50
    y: 50

alerts:
  cooldown_seconds: 60
  cpu_percent: 90
  ram_percent: 85
  disk_percent: 90
  cpu_temp_celsius: 80
  gpu_percent: 95
  battery_low: 15
```

---

## 7. Dependências (go.mod)

| Pacote | Uso |
|---|---|
| `github.com/wailsapp/wails/v2` | Framework GUI cross-platform |
| `github.com/shirou/gopsutil/v3` | Coleta de métricas do sistema |
| `github.com/gen2brain/beeep` | Notificações nativas (Mac/Linux/Win) |
| `gopkg.in/yaml.v3` | Parse e escrita do config.yaml |

GPU opcional:
- Linux/Win NVIDIA: `github.com/NVIDIA/go-nvml`
- macOS: via CGo com IOKit (build tag `darwin`)

---

## 8. Comportamento Cross-Platform

| Feature | macOS | Linux | Windows |
|---|---|---|---|
| WebView | WebKit | WebKitGTK | WebView2 |
| Transparência | ✓ | ✓ (compositor) | ✓ |
| Always-on-top | ✓ | ✓ | ✓ |
| Notificação | NSUserNotification | libnotify | WinToast |
| GPU stats | IOKit (CGo) | nvml / sysfs | nvml / DXGI |

---

## 9. Fora de Escopo

- Histórico gráfico de métricas (gráficos de linha ao longo do tempo)
- Monitoramento de processos individuais
- Interface de configuração além do menu de contexto e config.yaml
- Suporte a múltiplos monitores/telas
