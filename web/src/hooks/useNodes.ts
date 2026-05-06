import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addNode, deleteNode, getNode, listNodes, refreshNode } from '@/services/nodeApi';

export const nodeKeys = {
  all: ['nodes'] as const,
  list: () => [...nodeKeys.all, 'list'] as const,
  detail: (name: string) => [...nodeKeys.all, 'detail', name] as const,
};

export function useNodeList() {
  return useQuery({
    queryKey: nodeKeys.list(),
    queryFn: listNodes,
    refetchInterval: 20_000,
  });
}

export function useNode(name: string | undefined) {
  return useQuery({
    enabled: Boolean(name),
    queryKey: nodeKeys.detail(name ?? ''),
    queryFn: () => getNode(name as string),
    refetchInterval: 20_000,
  });
}

function useInvalidateNodes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: nodeKeys.all });
}

export function useAddNode() {
  const invalidate = useInvalidateNodes();
  return useMutation({ mutationFn: addNode, onSuccess: invalidate });
}

export function useDeleteNode() {
  const invalidate = useInvalidateNodes();
  return useMutation({ mutationFn: deleteNode, onSuccess: invalidate });
}

export function useRefreshNode() {
  const invalidate = useInvalidateNodes();
  return useMutation({ mutationFn: refreshNode, onSuccess: invalidate });
}
