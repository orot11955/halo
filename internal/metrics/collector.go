package metrics

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type Collector struct{}

func NewCollector() *Collector {
	return &Collector{}
}

func (c *Collector) Collect(ctx context.Context) (Snapshot, error) {
	snapshot := Snapshot{CollectedAt: time.Now().UTC()}

	load1, load5, load15, _ := readLoadAverage()
	usedCPU, _ := readCPUUsedPercent(ctx, 100*time.Millisecond)
	snapshot.CPU = CPU{
		Load1:       load1,
		Load5:       load5,
		Load15:      load15,
		UsedPercent: round2(usedCPU),
	}

	memoryUsed, _ := readMemoryUsedPercent()
	snapshot.Memory = Memory{UsedPercent: round2(memoryUsed)}

	rootDisk := readRootDisk()
	snapshot.Disk = Disk{
		RootUsedPercent: rootDisk.UsedPercent,
		Disks:           []DiskInfo{rootDisk},
	}

	network, _ := readNetwork()
	snapshot.Network = network

	return snapshot, nil
}

func readLoadAverage() (float64, float64, float64, error) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, err
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return 0, 0, 0, fmt.Errorf("unexpected /proc/loadavg format")
	}
	load1, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	load5, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	load15, err := strconv.ParseFloat(fields[2], 64)
	if err != nil {
		return 0, 0, 0, err
	}
	return load1, load5, load15, nil
}

type cpuTimes struct {
	idle  uint64
	total uint64
}

func readCPUUsedPercent(ctx context.Context, interval time.Duration) (float64, error) {
	first, err := readCPUTimes()
	if err != nil {
		return 0, err
	}

	timer := time.NewTimer(interval)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case <-timer.C:
	}

	second, err := readCPUTimes()
	if err != nil {
		return 0, err
	}

	totalDelta := second.total - first.total
	idleDelta := second.idle - first.idle
	if totalDelta == 0 {
		return 0, nil
	}
	return float64(totalDelta-idleDelta) * 100 / float64(totalDelta), nil
}

func readCPUTimes() (cpuTimes, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuTimes{}, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuTimes{}, fmt.Errorf("empty /proc/stat")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}, fmt.Errorf("unexpected /proc/stat format")
	}

	var total uint64
	values := make([]uint64, 0, len(fields)-1)
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return cpuTimes{}, err
		}
		values = append(values, value)
		total += value
	}

	idle := values[3]
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuTimes{idle: idle, total: total}, scanner.Err()
}

func readMemoryUsedPercent() (float64, error) {
	values, err := readMemInfo()
	if err != nil {
		return 0, err
	}
	total := values["MemTotal"]
	available := values["MemAvailable"]
	if total == 0 {
		return 0, nil
	}
	return float64(total-available) * 100 / float64(total), nil
}

func readMemInfo() (map[string]uint64, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	values := make(map[string]uint64)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		value, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}
		values[key] = value * 1024
	}
	return values, scanner.Err()
}

func readRootDisk() DiskInfo {
	info := DiskInfo{Mount: "/", Device: rootDevice()}
	if runtime.GOOS != "linux" {
		return info
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil || stat.Blocks == 0 {
		return info
	}
	used := stat.Blocks - stat.Bfree
	info.UsedPercent = round2(float64(used) * 100 / float64(stat.Blocks))
	return info
}

func rootDevice() string {
	file, err := os.Open("/proc/mounts")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 2 && fields[1] == "/" {
			return fields[0]
		}
	}
	return ""
}

func readNetwork() (Network, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return Network{}, err
	}
	defer file.Close()

	var network Network
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.Contains(line, ":") {
			continue
		}
		name, valuesText, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name = strings.TrimSpace(name)
		if name == "lo" {
			continue
		}
		values := strings.Fields(valuesText)
		if len(values) < 16 {
			continue
		}
		rxBytes, err := strconv.ParseUint(values[0], 10, 64)
		if err != nil {
			continue
		}
		txBytes, err := strconv.ParseUint(values[8], 10, 64)
		if err != nil {
			continue
		}
		network.RxBytesTotal += rxBytes
		network.TxBytesTotal += txBytes
		network.Interfaces = append(network.Interfaces, NetworkInterface{
			Name:    name,
			RxBytes: rxBytes,
			TxBytes: txBytes,
		})
	}
	return network, scanner.Err()
}

func round2(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}
