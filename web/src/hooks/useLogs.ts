import { useQuery } from '@tanstack/react-query';
import { listAllLogSources, listLogSources, tailLog } from '@/services/logApi';

export function useAllLogSources() {
  return useQuery({
    queryKey: ['log-sources', 'all'],
    queryFn: listAllLogSources,
  });
}

export function useLogSources(node: string | undefined) {
  return useQuery({
    enabled: Boolean(node),
    queryKey: ['log-sources', node],
    queryFn: () => listLogSources(node as string),
  });
}

export function useLogTail(node: string | undefined, sourceId: string | undefined, tail = 200) {
  return useQuery({
    enabled: Boolean(node && sourceId),
    queryKey: ['log-tail', node, sourceId, tail],
    queryFn: () => tailLog(node as string, sourceId as string, tail),
    refetchInterval: 10_000,
  });
}
