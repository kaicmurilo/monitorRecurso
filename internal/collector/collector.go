package collector

import (
	"path/filepath"
	"runtime"
	"strings"
	"time"

	bat "github.com/distatus/battery"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"
)

// DiskInfo holds usage info for a single mounted filesystem.
type DiskInfo struct {
	Path    string  `json:"Path"`
	Label   string  `json:"Label"`
	Percent float64 `json:"Percent"`
	UsedGB  float64 `json:"UsedGB"`
	TotalGB float64 `json:"TotalGB"`
}

// Metrics holds one snapshot of all system metrics.
// RawSent, RawRecv, RawTime are opaque state for the next Collect call — not sent to JS.
type Metrics struct {
	CPUPercent         float64    `json:"CPUPercent"`
	RAMPercent         float64    `json:"RAMPercent"`
	RAMUsedGB          float64    `json:"RAMUsedGB"`
	RAMTotalGB         float64    `json:"RAMTotalGB"`
	SwapPercent        float64    `json:"SwapPercent"`
	SwapUsedGB         float64    `json:"SwapUsedGB"`
	SwapTotalGB        float64    `json:"SwapTotalGB"`
	HasSwap            bool       `json:"HasSwap"`
	CPUTempCelsius     float64    `json:"CPUTempCelsius"`
	Disks              []DiskInfo `json:"Disks"`
	NetUpBytesPerSec   float64    `json:"NetUpBytesPerSec"`
	NetDownBytesPerSec float64    `json:"NetDownBytesPerSec"`
	GPUPercent         float64    `json:"GPUPercent"` // -1 if unavailable
	HasGPU             bool       `json:"HasGPU"`
	BatteryPercent     float64    `json:"BatteryPercent"` // -1 if no battery
	HasBattery         bool       `json:"HasBattery"`

	// Internal state — passed back to next Collect call; not exposed to JS.
	RawSent uint64 `json:"RawSent"`
	RawRecv uint64 `json:"RawRecv"`
	RawTime int64  `json:"RawTime"` // UnixNano
}

// skipFSType lists filesystem types that are not real storage.
var skipFSType = map[string]bool{
	"devtmpfs": true, "tmpfs": true, "sysfs": true, "proc": true, "procfs": true,
	"cgroup": true, "cgroup2": true, "tracefs": true, "securityfs": true,
	"pstore": true, "devpts": true, "mqueue": true, "hugetlbfs": true,
	"fusectl": true, "debugfs": true, "configfs": true, "binfmt_misc": true,
	"overlay": true, "autofs": true, "nsfs": true, "squashfs": true,
	"efivarfs": true, "bpf": true, "devfs": true, "synthfs": true,
	"kernfs": true, "rpc_pipefs": true, "ramfs": true, "iso9660": true,
}

func isPhysicalMount(p disk.PartitionStat) bool {
	if skipFSType[p.Fstype] {
		return false
	}
	// macOS APFS synthetic sub-volumes
	if strings.HasPrefix(p.Mountpoint, "/System/Volumes") {
		return false
	}
	// Linux virtual paths
	if p.Mountpoint == "/dev" ||
		strings.HasPrefix(p.Mountpoint, "/proc") ||
		strings.HasPrefix(p.Mountpoint, "/sys") ||
		strings.HasPrefix(p.Mountpoint, "/run/") {
		return false
	}
	return true
}

func diskLabel(mountpoint string) string {
	if mountpoint == "/" {
		return "Root"
	}
	// Windows: C:\ → C:
	if runtime.GOOS == "windows" && len(mountpoint) >= 2 && mountpoint[1] == ':' {
		return strings.ToUpper(mountpoint[:2])
	}
	base := filepath.Base(mountpoint)
	if base == "" || base == "." || base == "/" {
		return mountpoint
	}
	// Capitalize first letter
	return strings.ToUpper(base[:1]) + base[1:]
}

// Collect gathers all system metrics.
// Pass rawSent=0, rawRecv=0, rawTime=0 on the first call.
func Collect(prevSent, prevRecv uint64, prevTimeNano int64) (Metrics, error) {
	var m Metrics

	// CPU — non-blocking: returns delta since last gopsutil call
	percents, err := cpu.Percent(0, false)
	if err == nil && len(percents) > 0 {
		m.CPUPercent = percents[0]
	}

	// RAM
	vm, err := mem.VirtualMemory()
	if err == nil {
		m.RAMPercent = vm.UsedPercent
		m.RAMUsedGB  = float64(vm.Used) / 1e9
		m.RAMTotalGB = float64(vm.Total) / 1e9
	}

	// Swap
	swp, err := mem.SwapMemory()
	if err == nil && swp.Total > 0 {
		m.SwapPercent = swp.UsedPercent
		m.SwapUsedGB  = float64(swp.Used) / 1e9
		m.SwapTotalGB = float64(swp.Total) / 1e9
		m.HasSwap = true
	}

	// Disks — enumerate physical partitions
	parts, err := disk.Partitions(false)
	if err == nil {
		seen := make(map[string]bool)
		for _, p := range parts {
			if !isPhysicalMount(p) || seen[p.Mountpoint] {
				continue
			}
			du, err := disk.Usage(p.Mountpoint)
			if err != nil || du.Total < 1_000_000_000 { // skip < 1 GB
				continue
			}
			seen[p.Mountpoint] = true
			m.Disks = append(m.Disks, DiskInfo{
				Path:    p.Mountpoint,
				Label:   diskLabel(p.Mountpoint),
				Percent: du.UsedPercent,
				UsedGB:  float64(du.Used) / 1e9,
				TotalGB: float64(du.Total) / 1e9,
			})
		}
	}

	// CPU Temperature — filter for CPU-related sensors
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			key := strings.ToLower(t.SensorKey)
			if t.Temperature > 0 && (strings.Contains(key, "cpu") || strings.Contains(key, "core") || strings.Contains(key, "k10temp")) {
				m.CPUTempCelsius = t.Temperature
				break
			}
		}
	}

	// Network — capture time before IO call so RawTime is always set
	now := time.Now()
	netStats, err := gnet.IOCounters(false)
	m.RawTime = now.UnixNano() // always set, regardless of error
	if err == nil && len(netStats) > 0 {
		sent := netStats[0].BytesSent
		recv := netStats[0].BytesRecv
		if prevTimeNano > 0 {
			elapsed := now.Sub(time.Unix(0, prevTimeNano)).Seconds()
			if elapsed > 0 {
				if sent >= prevSent && recv >= prevRecv {
					m.NetUpBytesPerSec = float64(sent-prevSent) / elapsed
					m.NetDownBytesPerSec = float64(recv-prevRecv) / elapsed
				}
			}
		}
		m.RawSent = sent
		m.RawRecv = recv
	}

	// GPU (platform-specific stub — see gpu.go)
	m.GPUPercent = collectGPU()
	m.HasGPU = m.GPUPercent >= 0

	// Battery
	m.BatteryPercent = -1
	batteries, err := bat.GetAll()
	if err == nil && len(batteries) > 0 {
		b := batteries[0]
		if b.Full > 0 {
			m.BatteryPercent = (b.Current / b.Full) * 100
			m.HasBattery = true
		}
	}

	return m, nil
}
