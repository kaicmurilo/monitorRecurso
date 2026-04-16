package alert

import "time"

// ForceExpireCooldown sets the last-fired time for a metric (test helper only).
// This file is compiled only during go test and never included in the production binary.
func (e *Engine) ForceExpireCooldown(metric string, t time.Time) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.lastFired[metric] = t
}
