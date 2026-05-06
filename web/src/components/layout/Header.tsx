import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { useStreamConnection } from '@/app/StreamContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './Header.module.css';

export interface HeaderProps {
  crumbs?: string[];
  title: ReactNode;
  /** Override the live indicator. Default: read from StreamContext. */
  streamConnected?: boolean;
  streamLabel?: string;
  actions?: ReactNode;
}

export function Header({
  crumbs,
  title,
  streamConnected,
  streamLabel,
  actions,
}: HeaderProps) {
  const t = useT();
  const ctxConnected = useStreamConnection();
  const isConnected = streamConnected ?? ctxConnected;
  const liveLabel = streamLabel ?? (isConnected ? t('stream.live') : t('stream.idle'));
  return (
    <>
      <div className={styles.title}>
        {crumbs && crumbs.length > 0 && (
          <div className={styles.crumbs}>{crumbs.join(' / ')}</div>
        )}
        <div className={styles.heading}>{title}</div>
      </div>
      <div className={styles.tools}>
        {actions}
        <span className={styles.streamPill}>
          <span className={cn(styles.streamDot, !isConnected && styles.streamDotIdle)} />
          {liveLabel}
        </span>
        <LanguageSwitcher />
        <div className={styles.user} aria-label={t('header.user')}>
          <Icon name="user" size={14} />
        </div>
      </div>
    </>
  );
}
