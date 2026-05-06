import { useQuery } from '@tanstack/react-query';
import { listContainers } from '@/services/containerApi';

export function useContainers(node: string | undefined) {
  return useQuery({
    enabled: Boolean(node),
    queryKey: ['containers', node],
    queryFn: () => listContainers(node as string),
    refetchInterval: 30_000,
  });
}
