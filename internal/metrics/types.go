package metrics

import "time"

type Snapshot struct {
	CollectedAt time.Time `json:"collected_at"`
	CPU         CPU       `json:"cpu"`
	Memory      Memory    `json:"memory"`
	Disk        Disk      `json:"disk"`
	Network     Network   `json:"network"`
}

type CPU struct {
	Load1       float64 `json:"load_1"`
	Load5       float64 `json:"load_5"`
	Load15      float64 `json:"load_15"`
	UsedPercent float64 `json:"used_percent"`
}

type Memory struct {
	UsedPercent float64 `json:"used_percent"`
}

type Disk struct {
	RootUsedPercent float64    `json:"root_used_percent"`
	Disks           []DiskInfo `json:"disks"`
}

type DiskInfo struct {
	Mount       string  `json:"mount"`
	Device      string  `json:"device"`
	UsedPercent float64 `json:"used_percent"`
}

type Network struct {
	RxBytesTotal uint64             `json:"rx_bytes_total"`
	TxBytesTotal uint64             `json:"tx_bytes_total"`
	Interfaces   []NetworkInterface `json:"interfaces"`
}

type NetworkInterface struct {
	Name    string `json:"name"`
	RxBytes uint64 `json:"rx_bytes"`
	TxBytes uint64 `json:"tx_bytes"`
}
