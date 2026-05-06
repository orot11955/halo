import { useQuery } from '@tanstack/react-query';
import { listPorts } from '@/services/portApi';

export function usePorts(node: string | undefined) {
  return useQuery({
    enabled: Boolean(node),
    queryKey: ['ports', node],
    queryFn: () => listPorts(node as string),
    refetchInterval: 60_000,
  });
}
