import { useQuery } from '@tanstack/react-query';
import { getMetricsHistory } from '@/services/metricsApi';
import type { MetricsRange } from '@/types/metrics';

const REFRESH_BY_RANGE: Record<MetricsRange, number> = {
  '5m': 15_000,
  '1h': 30_000,
  '6h': 120_000,
  '24h': 300_000,
  '7d': 600_000,
};

export const metricsKeys = {
  all: ['metrics'] as const,
  history: (node: string, range: MetricsRange) =>
    [...metricsKeys.all, 'history', node, range] as const,
};

export function useMetricsHistory(node: string | undefined, range: MetricsRange) {
  return useQuery({
    enabled: Boolean(node),
    queryKey: metricsKeys.history(node ?? '', range),
    queryFn: () => getMetricsHistory(node as string, range),
    refetchInterval: REFRESH_BY_RANGE[range],
  });
}
