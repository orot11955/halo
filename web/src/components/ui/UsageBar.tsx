import { usageTone } from '@/utils/status';
import { formatPercent } from '@/utils/format';
import styles from './UsageBar.module.css';

interface UsageBarProps {
  percent: number;
  showValue?: boolean;
}

export function UsageBar({ percent, showValue = true }: UsageBarProps) {
  const tone = usageTone(percent);
  return (
    <div className={styles.row}>
      <div className={styles.bar}>
        <div
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      {showValue && <div className={styles.value}>{formatPercent(percent)}</div>}
    </div>
  );
}
