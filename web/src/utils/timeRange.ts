export type TimeRange = 'all' | '15m' | '1h' | '24h' | '7d';

export const TIME_RANGE_OPTIONS: TimeRange[] = ['all', '15m', '1h', '24h', '7d'];

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
};

export function isTimeRange(value: string | null | undefined): value is TimeRange {
  return TIME_RANGE_OPTIONS.includes(value as TimeRange);
}

export function isWithinTimeRange(
  value: string,
  range: TimeRange,
  nowMs: number = Date.now(),
): boolean {
  if (range === 'all') return true;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return false;
  return ts >= nowMs - TIME_RANGE_MS[range];
}
