import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAsset,
  createConnection,
  deleteAsset,
  getTopology,
  listAssets,
  listImpact,
  updateAssetPosition,
} from '@/services/topologyApi';

const TOPOLOGY_KEY = ['topology'] as const;

export function useTopologyGraph() {
  return useQuery({ queryKey: ['topology', 'graph'], queryFn: getTopology });
}

export function useAssets() {
  return useQuery({ queryKey: ['topology', 'assets'], queryFn: listAssets });
}

export function useImpact() {
  return useQuery({ queryKey: ['topology', 'impact'], queryFn: listImpact });
}

function useInvalidateTopology() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: TOPOLOGY_KEY });
}

export function useCreateAsset() {
  const invalidate = useInvalidateTopology();
  return useMutation({ mutationFn: createAsset, onSuccess: invalidate });
}

export function useDeleteAsset() {
  const invalidate = useInvalidateTopology();
  return useMutation({ mutationFn: deleteAsset, onSuccess: invalidate });
}

export function useCreateConnection() {
  const invalidate = useInvalidateTopology();
  return useMutation({ mutationFn: createConnection, onSuccess: invalidate });
}

export function useUpdateAssetPosition() {
  const invalidate = useInvalidateTopology();
  return useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      updateAssetPosition(id, x, y),
    // Don't invalidate on success — the position is already optimistically
    // applied locally; refetching would briefly snap back to the server value.
    // Only invalidate on error so the UI re-syncs with truth.
    onError: invalidate,
  });
}
