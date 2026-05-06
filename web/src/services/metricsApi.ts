import { delay, MOCK_MODE, request } from './apiClient';
import { generateMetricsHistory } from '@/mocks/metrics';
import { METRICS_STEP_BY_RANGE, type MetricsHistory, type MetricsRange } from '@/types/metrics';
import { mapMetricsHistory, type HalocMetricHistory } from './halocAdapters';

export async function getMetricsHistory(
  node: string,
  range: MetricsRange,
): Promise<MetricsHistory> {
  if (MOCK_MODE) return delay(generateMetricsHistory(node, range));
  const step = METRICS_STEP_BY_RANGE[range];
  const history = await request<HalocMetricHistory>(
    `/nodes/${encodeURIComponent(node)}/metrics/history?range=${range}&step=${encodeURIComponent(step)}`,
  );
  return mapMetricsHistory(history);
}
