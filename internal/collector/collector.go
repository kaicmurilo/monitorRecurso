package collector

import (
	"time"

	bat "github.com/distatus/battery"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	gnet "github.com/shirou/gopsutil/v3/net"
)

// Metrics holds one snapshot of all system metrics.
// RawSent, RawRecv, RawTime are opaque state for the next Collect call — not sent to JS.
type Metrics struct {
	CPUPercent         float64
	RAMPercent         float64
	DiskPercent        float64
	CPUTempCelsius     float64
	NetUpBytesPerSec   float64
	NetDownBytesPerSec float64
	GPUPercent         float64 // -1 if unavailable
	BatteryPercent     float64 // -1 if no battery
	HasGPU             bool
	HasBattery         bool

	// Internal state — passed back to next Collect call; not exposed to JS.
	RawSent uint64
	RawRecv uint64
	RawTime int64 // UnixNano
}

// Collect gathers all system metrics.
// Pass rawSent=0, rawRecv=0, rawTime=0 on the first call.
func Collect(prevSent, prevRecv uint64, prevTimeNano int64) (Metrics, error) {
	var m Metrics

	// CPU (200ms sample)
	percents, err := cpu.Percent(200*time.Millisecond, false)
	if err == nil && len(percents) > 0 {
		m.CPUPercent = percents[0]
	}

	// RAM
	vm, err := mem.VirtualMemory()
	if err == nil {
		m.RAMPercent = vm.UsedPercent
	}

	// Disk (root partition)
	du, err := disk.Usage("/")
	if err == nil {
		m.DiskPercent = du.UsedPercent
	}

	// CPU Temperature (best-effort)
	temps, err := host.SensorsTemperatures()
	if err == nil {
		for _, t := range temps {
			if t.Temperature > 0 {
				m.CPUTempCelsius = t.Temperature
				break
			}
		}
	}

	// Network
	netStats, err := gnet.IOCounters(false)
	now := time.Now()
	if err == nil && len(netStats) > 0 {
		sent := netStats[0].BytesSent
		recv := netStats[0].BytesRecv
		if prevTimeNano > 0 {
			elapsed := now.Sub(time.Unix(0, prevTimeNano)).Seconds()
			if elapsed > 0 {
				m.NetUpBytesPerSec = float64(sent-prevSent) / elapsed
				m.NetDownBytesPerSec = float64(recv-prevRecv) / elapsed
			}
		}
		m.RawSent = sent
		m.RawRecv = recv
		m.RawTime = now.UnixNano()
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
