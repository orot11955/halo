import { delay, MOCK_MODE, request } from './apiClient';
import { buildMockDashboard } from '@/mocks/dashboard';
import type { DashboardSummary } from '@/types/dashboard';
import { mapDashboard, type HalocDashboard } from './halocAdapters';

export async function getDashboard(): Promise<DashboardSummary> {
  if (MOCK_MODE) return delay(buildMockDashboard());
  const dashboard = await request<HalocDashboard>('/dashboard');
  return mapDashboard(dashboard, dashboard.nodes);
}
