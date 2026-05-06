import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { Tone } from '@/utils/status';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  tone?: Tone;
  dot?: boolean;
  variant?: 'pill' | 'solid';
  children: ReactNode;
  className?: string;
}

export function StatusBadge({
  tone = 'neutral',
  dot = false,
  variant = 'pill',
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span className={cn(styles.badge, styles[tone], variant === 'solid' && styles.solid, className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
