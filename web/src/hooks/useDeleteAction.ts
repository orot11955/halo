import { useCallback } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useT } from '@/i18n';

interface ConfirmDeleteArgs {
  title: string;
  description?: string;
}

/**
 * Asks the user to confirm a destructive action. Returns true on confirm,
 * false on cancel. The caller still owns the actual mutation and any
 * post-success toast — this hook just wraps the dialog wiring + the
 * default Confirm/Cancel labels for delete buttons.
 */
export function useConfirmDelete() {
  const confirm = useConfirm();
  const t = useT();
  return useCallback(
    ({ title, description }: ConfirmDeleteArgs) =>
      confirm({
        title,
        description,
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
        tone: 'danger',
      }),
    [confirm, t],
  );
}

/**
 * Convenience: returns toast helpers shaped for mutation feedback. The
 * `mutationError` toast extracts the standard ApiError message.
 */
export function useMutationToast() {
  const toast = useToast();
  const t = useT();
  return {
    success: (title: string, detail?: string) => toast.show({ tone: 'success', title, detail }),
    error: (err: unknown, title?: string) =>
      toast.show({
        tone: 'error',
        title: title ?? t('common.error'),
        detail: (err as Error)?.message,
      }),
  };
}
