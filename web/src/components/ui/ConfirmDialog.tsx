import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal, ModalErrorBanner } from './Modal';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm button color tone. */
  tone?: 'default' | 'danger';
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setError(null);
      setPending({ ...opts, resolve });
    });
  }, []);

  const finish = (ok: boolean) => {
    if (!pending) return;
    pending.resolve(ok);
    setPending(null);
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(pending)}
        onClose={() => finish(false)}
        title={pending?.title ?? ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => finish(false)}>
              {pending?.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              variant={pending?.tone === 'danger' ? 'primary' : 'primary'}
              onClick={() => finish(true)}
              autoFocus
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {error && <ModalErrorBanner>{error}</ModalErrorBanner>}
        {pending?.description && (
          <div style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
            {pending.description}
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx.confirm;
}
