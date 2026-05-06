import type { MetricPoint, MetricsHistory, MetricsRange } from '@/types/metrics';

const STEP_SECONDS: Record<MetricsRange, number> = {
  '5m': 15,
  '1h': 30,
  '6h': 120,
  '24h': 300,
  '7d': 3600,
};

const RANGE_SECONDS: Record<MetricsRange, number> = {
  '5m': 5 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
};

const STEP_LABEL: Record<MetricsRange, string> = {
  '5m': '15s',
  '1h': '30s',
  '6h': '2m',
  '24h': '5m',
  '7d': '1h',
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function generateMetricsHistory(node: string, range: MetricsRange): MetricsHistory {
  const stepSec = STEP_SECONDS[range];
  const totalSec = RANGE_SECONDS[range];
  const count = Math.floor(totalSec / stepSec) + 1;
  const random = rng(hash(`${node}:${range}`));

  const cpuBase = 10 + random() * 30;
  const memBase = 40 + random() * 30;
  const diskBase = 30 + random() * 40;
  let rxAcc = 1_000_000 + Math.floor(random() * 5_000_000);
  let txAcc = 1_000_000 + Math.floor(random() * 5_000_000);

  const points: MetricPoint[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * stepSec * 1000;
    const wave = Math.sin(i / 12) * 6 + Math.sin(i / 5) * 3;
    const cpu = clamp(cpuBase + wave + (random() - 0.5) * 8, 1, 99);
    const mem = clamp(memBase + Math.sin(i / 18) * 4 + (random() - 0.5) * 3, 5, 98);
    const disk = clamp(diskBase + Math.sin(i / 90) * 1.5 + (random() - 0.5) * 0.4, 1, 99);
    rxAcc += Math.floor(50_000 + random() * 200_000);
    txAcc += Math.floor(40_000 + random() * 180_000);

    points.push({
      time: new Date(t).toISOString(),
      cpu_load_1: +(cpu / 100 * 4).toFixed(2),
      cpu_load_5: +(cpu / 100 * 3.6).toFixed(2),
      cpu_load_15: +(cpu / 100 * 3.2).toFixed(2),
      cpu_used_percent: +cpu.toFixed(1),
      memory_used_percent: +mem.toFixed(1),
      disk_root_used_percent: +disk.toFixed(1),
      network_rx_bytes_total: rxAcc,
      network_tx_bytes_total: txAcc,
    });
  }

  return {
    node,
    range,
    step: STEP_LABEL[range],
    points,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
