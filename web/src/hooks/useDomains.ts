import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDomain, checkDomain, deleteDomain, listDomains } from '@/services/domainApi';

export const domainKeys = {
  all: ['domains'] as const,
  list: () => [...domainKeys.all, 'list'] as const,
};

export function useDomainList() {
  return useQuery({
    queryKey: domainKeys.list(),
    queryFn: listDomains,
    refetchInterval: 60_000,
  });
}

function useInvalidateDomains() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: domainKeys.all });
}

export function useAddDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({ mutationFn: addDomain, onSuccess: invalidate });
}

export function useDeleteDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({ mutationFn: deleteDomain, onSuccess: invalidate });
}

export function useCheckDomain() {
  const invalidate = useInvalidateDomains();
  return useMutation({ mutationFn: checkDomain, onSuccess: invalidate });
}
