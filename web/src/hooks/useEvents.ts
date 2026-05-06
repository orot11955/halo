import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from './useDashboard';
import { listEvents, resolveEvent } from '@/services/eventApi';

export const eventKeys = {
  all: ['events'] as const,
  list: () => [...eventKeys.all, 'list'] as const,
};

export function useEventList() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: listEvents,
    refetchInterval: 30_000,
  });
}

export function useResolveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolveEvent,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.all });
      void qc.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
