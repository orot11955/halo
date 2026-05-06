import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addService, checkService, deleteService, listServices } from '@/services/serviceApi';

export const serviceKeys = {
  all: ['services'] as const,
  list: () => [...serviceKeys.all, 'list'] as const,
};

export function useServiceList() {
  return useQuery({
    queryKey: serviceKeys.list(),
    queryFn: listServices,
    refetchInterval: 30_000,
  });
}

function useInvalidateServices() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: serviceKeys.all });
}

export function useAddService() {
  const invalidate = useInvalidateServices();
  return useMutation({ mutationFn: addService, onSuccess: invalidate });
}

export function useDeleteService() {
  const invalidate = useInvalidateServices();
  return useMutation({ mutationFn: deleteService, onSuccess: invalidate });
}

export function useCheckService() {
  const invalidate = useInvalidateServices();
  return useMutation({ mutationFn: checkService, onSuccess: invalidate });
}
