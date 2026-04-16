package collector_test

import (
	"testing"

	"monitorRecurso/internal/collector"
)

func TestCollectReturnsValidRanges(t *testing.T) {
	m, err := collector.Collect(0, 0, 0)
	if err != nil {
		t.Fatalf("Collect failed: %v", err)
	}
	if m.CPUPercent < 0 || m.CPUPercent > 100 {
		t.Errorf("CPUPercent out of range: %f", m.CPUPercent)
	}
	if m.RAMPercent < 0 || m.RAMPercent > 100 {
		t.Errorf("RAMPercent out of range: %f", m.RAMPercent)
	}
	for _, d := range m.Disks {
		if d.Percent < 0 || d.Percent > 100 {
			t.Errorf("Disk %s percent out of range: %f", d.Label, d.Percent)
		}
		if d.TotalGB <= 0 {
			t.Errorf("Disk %s TotalGB should be > 0, got %f", d.Label, d.TotalGB)
		}
	}
	if m.NetUpBytesPerSec < 0 {
		t.Error("NetUpBytesPerSec should not be negative")
	}
	if m.NetDownBytesPerSec < 0 {
		t.Error("NetDownBytesPerSec should not be negative")
	}
}

func TestCollectTwiceGivesNetworkDelta(t *testing.T) {
	m1, err := collector.Collect(0, 0, 0)
	if err != nil {
		t.Fatalf("first Collect failed: %v", err)
	}
	m2, err := collector.Collect(m1.RawSent, m1.RawRecv, m1.RawTime)
	if err != nil {
		t.Fatalf("second Collect failed: %v", err)
	}
	if m2.NetUpBytesPerSec < 0 || m2.NetDownBytesPerSec < 0 {
		t.Error("network bytes/sec should not be negative after two calls")
	}
}
