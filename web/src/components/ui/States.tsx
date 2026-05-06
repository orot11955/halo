import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { useT } from '@/i18n';
import styles from './States.module.css';

interface EmptyStateProps {
  title?: ReactNode;
  detail?: ReactNode;
  icon?: IconName;
}

export function EmptyState({ title, detail, icon = 'inbox' }: EmptyStateProps) {
  const t = useT();
  return (
    <div className={styles.state}>
      <div className={styles.icon}>
        <Icon name={icon} size={20} />
      </div>
      <div className={styles.title}>{title ?? t('common.empty')}</div>
      {detail && <div className={styles.detail}>{detail}</div>}
    </div>
  );
}

interface LoadingStateProps {
  label?: ReactNode;
}

export function LoadingState({ label }: LoadingStateProps) {
  const t = useT();
  return (
    <div className={styles.state}>
      <div className={styles.spinner} />
      <div className={styles.detail}>{label ?? t('common.loading')}</div>
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
}

export function ErrorState({ error }: ErrorStateProps) {
  const t = useT();
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  return (
    <div className={styles.errorBox}>
      <span className={styles.errorIcon}>
        <Icon name="alert" size={16} />
      </span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('common.errorTitle')}</div>
        <div>{message}</div>
      </div>
    </div>
  );
}

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.skeletonRow} style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
