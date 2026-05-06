import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import styles from './Grid.module.css';

interface GridProps {
  cols?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}

export function Grid({ cols = 3, children, className }: GridProps) {
  return <div className={cn(styles.grid, styles[`cols-${cols}`], className)}>{children}</div>;
}

export function Split({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(styles.split, className)}>{children}</div>;
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className={styles.statRow}>{children}</div>;
}
