export type MetricsRange = '5m' | '1h' | '6h' | '24h' | '7d';

export interface MetricPoint {
  time: string;
  cpu_load_1: number;
  cpu_load_5: number;
  cpu_load_15: number;
  cpu_used_percent: number;
  memory_used_percent: number;
  disk_root_used_percent: number;
  network_rx_bytes_total: number;
  network_tx_bytes_total: number;
}

export interface MetricsHistory {
  node: string;
  range: MetricsRange;
  step: string;
  points: MetricPoint[];
}

export const METRICS_STEP_BY_RANGE: Record<MetricsRange, string> = {
  '5m': '15s',
  '1h': '30s',
  '6h': '2m',
  '24h': '5m',
  '7d': '1h',
};

export const METRICS_RANGE_OPTIONS: { value: MetricsRange; label: string; stepLabel: string }[] = [
  { value: '5m', label: '5m', stepLabel: METRICS_STEP_BY_RANGE['5m'] },
  { value: '1h', label: '1h', stepLabel: METRICS_STEP_BY_RANGE['1h'] },
  { value: '6h', label: '6h', stepLabel: METRICS_STEP_BY_RANGE['6h'] },
  { value: '24h', label: '24h', stepLabel: METRICS_STEP_BY_RANGE['24h'] },
  { value: '7d', label: '7d', stepLabel: METRICS_STEP_BY_RANGE['7d'] },
];
