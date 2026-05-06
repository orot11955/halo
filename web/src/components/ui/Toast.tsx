import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  detail?: string;
  /** Auto-dismiss after this many ms. 0 = sticky. Default 4000. */
  duration?: number;
}

interface Toast extends Required<Pick<ToastInput, 'tone' | 'title'>> {
  id: number;
  detail?: string;
  duration: number;
}

interface ToastContextValue {
  show: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'x',
  warning: 'alert',
  info: 'info',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const toast: Toast = {
        id: nextId++,
        tone: input.tone ?? 'info',
        title: input.title,
        detail: input.detail,
        duration: input.duration ?? 4000,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        const handle = setTimeout(() => dismiss(toast.id), toast.duration);
        timers.current.set(toast.id, handle);
      }
    },
    [dismiss],
  );

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      for (const handle of timers.current.values()) clearTimeout(handle);
      timers.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className={styles.region} role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`${styles.toast} ${styles[t.tone] ?? ''}`}
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              <span className={styles.icon}>
                <Icon name={TONE_ICON[t.tone]} size={16} />
              </span>
              <div className={styles.body}>
                <div className={styles.title}>{t.title}</div>
                {t.detail && <div className={styles.detail}>{t.detail}</div>}
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
