import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addRunbook, deleteRunbook, getRunbook, listRunbooks } from '@/services/runbookApi';

export function useRunbooks() {
  return useQuery({ queryKey: ['runbooks'], queryFn: listRunbooks });
}

export function useRunbook(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ['runbooks', id],
    queryFn: () => getRunbook(id as string),
  });
}

function useInvalidateRunbooks() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['runbooks'] });
}

export function useAddRunbook() {
  const invalidate = useInvalidateRunbooks();
  return useMutation({ mutationFn: addRunbook, onSuccess: invalidate });
}

export function useDeleteRunbook() {
  const invalidate = useInvalidateRunbooks();
  return useMutation({ mutationFn: deleteRunbook, onSuccess: invalidate });
}
