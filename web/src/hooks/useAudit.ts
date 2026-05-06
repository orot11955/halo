import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMaintenance,
  deleteMaintenance,
  listAuditLog,
  listMaintenance,
} from '@/services/auditApi';

export function useAuditLog() {
  return useQuery({ queryKey: ['audit-log'], queryFn: listAuditLog });
}

export function useMaintenance() {
  return useQuery({ queryKey: ['maintenance'], queryFn: listMaintenance });
}

function useInvalidateMaintenance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['maintenance'] });
}

export function useAddMaintenance() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({ mutationFn: addMaintenance, onSuccess: invalidate });
}

export function useDeleteMaintenance() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({ mutationFn: deleteMaintenance, onSuccess: invalidate });
}
