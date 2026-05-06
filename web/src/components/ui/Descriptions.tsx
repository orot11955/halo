import type { ReactNode } from 'react';
import styles from './Descriptions.module.css';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
}

interface DescriptionsProps {
  items: DescriptionItem[];
}

export function Descriptions({ items }: DescriptionsProps) {
  return (
    <div className={styles.grid}>
      {items.map((item, i) => (
        <div key={i} className={styles.item}>
          <div className={styles.label}>{item.label}</div>
          <div className={styles.value}>{item.value ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}
