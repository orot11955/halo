import type { ReactNode } from 'react';
import type { Tone } from '@/utils/status';
import styles from './Stat.module.css';

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}

export function Stat({ label, value, unit, hint, tone = 'neutral' }: StatProps) {
  return (
    <div className={styles.stat}>
      <div className={styles.label}>{label}</div>
      <div className={styles.row}>
        <div className={`${styles.value} ${styles[`tone-${tone}`]}`}>{value}</div>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
