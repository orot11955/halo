import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '@/services/dashboardApi';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: getDashboard,
    refetchInterval: 15_000,
  });
}
