package haloc

import (
	"math"
	"testing"
	"time"

	"halo/internal/storage"
)

func TestMetricHistoryPointsBucketsAveragesAndKeepsLatestCounters(t *testing.T) {
	since := time.Date(2026, 5, 6, 12, 0, 0, 0, time.UTC)
	snapshots := []storage.MetricSnapshot{
		{
			CPULoad1:            1,
			CPULoad5:            5,
			CPULoad15:           15,
			CPUUsedPercent:      10,
			MemoryUsedPercent:   20,
			DiskRootUsedPercent: 30,
			NetworkRxBytesTotal: 100,
			NetworkTxBytesTotal: 200,
			CollectedAt:         since.Add(10 * time.Second),
		},
		{
			CPULoad1:            3,
			CPULoad5:            7,
			CPULoad15:           17,
			CPUUsedPercent:      30,
			MemoryUsedPercent:   40,
			DiskRootUsedPercent: 50,
			NetworkRxBytesTotal: 300,
			NetworkTxBytesTotal: 400,
			CollectedAt:         since.Add(20 * time.Second),
		},
		{
			CPULoad1:            5,
			CPULoad5:            9,
			CPULoad15:           19,
			CPUUsedPercent:      50,
			MemoryUsedPercent:   60,
			DiskRootUsedPercent: 70,
			NetworkRxBytesTotal: 500,
			NetworkTxBytesTotal: 600,
			CollectedAt:         since.Add(65 * time.Second),
		},
	}

	points := metricHistoryPoints("orbit", snapshots, since, time.Minute)
	if len(points) != 2 {
		t.Fatalf("len(points) = %d, want 2", len(points))
	}
	if !points[0].CollectedAt.Equal(since) {
		t.Fatalf("first bucket time = %s, want %s", points[0].CollectedAt, since)
	}
	if !points[1].CollectedAt.Equal(since.Add(time.Minute)) {
		t.Fatalf("second bucket time = %s, want %s", points[1].CollectedAt, since.Add(time.Minute))
	}
	assertFloat(t, "first cpu load", points[0].CPULoad1, 2)
	assertFloat(t, "first cpu used", points[0].CPUUsedPercent, 20)
	assertFloat(t, "first memory used", points[0].MemoryUsedPercent, 30)
	assertFloat(t, "first disk used", points[0].DiskRootUsedPercent, 40)
	if points[0].NetworkRxBytesTotal != 300 || points[0].NetworkTxBytesTotal != 400 {
		t.Fatalf("first network totals = %d/%d, want 300/400", points[0].NetworkRxBytesTotal, points[0].NetworkTxBytesTotal)
	}
	assertFloat(t, "second cpu load", points[1].CPULoad1, 5)
	if points[1].NetworkRxBytesTotal != 500 || points[1].NetworkTxBytesTotal != 600 {
		t.Fatalf("second network totals = %d/%d, want 500/600", points[1].NetworkRxBytesTotal, points[1].NetworkTxBytesTotal)
	}
}

func assertFloat(t *testing.T, name string, got float64, want float64) {
	t.Helper()
	if math.Abs(got-want) > 0.000001 {
		t.Fatalf("%s = %f, want %f", name, got, want)
	}
}
