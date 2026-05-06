import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import styles from './Card.module.css';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  className?: string;
  /** widget id to support future Dashboard sandbox layout persistence */
  widgetId?: string;
}

export function Card({
  title,
  subtitle,
  actions,
  flush = false,
  children,
  className,
  widgetId,
}: CardProps) {
  return (
    <section className={cn(styles.card, className)} data-widget-id={widgetId}>
      {(title || actions) && (
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            {title && <div className={styles.title}>{title}</div>}
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={cn(styles.body, flush && styles.bodyFlush)}>{children}</div>
    </section>
  );
}
