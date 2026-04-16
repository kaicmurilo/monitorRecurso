package collector

// collectGPU returns the GPU utilization percentage, or -1 if unavailable.
// To add real GPU support:
//   - NVIDIA (Linux/Windows): import github.com/NVIDIA/go-nvml and call nvml.DeviceGetUtilizationRates
//   - macOS: use CGo with IOKit or parse `powermetrics` output
func collectGPU() float64 {
	return -1
}
