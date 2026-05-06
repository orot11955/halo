import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { Tone } from '@/utils/status';
import styles from './widgets.module.css';

export interface SummaryDatum {
  label: ReactNode;
  value: number;
  tone?: Tone;
  /** Optional path to navigate to when the stat cell is clicked. */
  href?: string;
}

interface SummaryWidgetProps {
  title: ReactNode;
  total: number;
  unit: string;
  items: SummaryDatum[];
  widgetId: string;
  icon?: IconName;
  /** Path the title links to. */
  href?: string;
}

export function SummaryWidget({
  title,
  total,
  unit,
  items,
  widgetId,
  icon,
  href,
}: SummaryWidgetProps) {
  const heading = (
    <span className={styles.titleWithIcon}>
      {icon && (
        <span className={styles.titleIcon}>
          <Icon name={icon} size={14} />
        </span>
      )}
      {title}
    </span>
  );
  return (
    <Card
      title={
        href ? (
          <Link to={href} className={styles.titleLink}>
            {heading}
          </Link>
        ) : (
          heading
        )
      }
      subtitle={`${total} ${unit}`}
      widgetId={widgetId}
      actions={items
        .filter((item) => item.value > 0 && item.tone && item.tone !== 'neutral')
        .map((item, i) => (
          <StatusBadge key={i} tone={item.tone} dot>
            {item.value} {item.label}
          </StatusBadge>
        ))}
    >
      <div className={styles.summaryRow}>
        {items.map((item, idx) => {
          const cell = (
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>{item.label}</div>
              <div
                className={styles.summaryValue}
                style={item.tone ? { color: `var(--color-${tonalColor(item.tone)})` } : undefined}
              >
                {item.value}
              </div>
            </div>
          );
          // A stat is only clickable when it has both a destination and a
          // non-zero value. Linking through zero counts to an empty list
          // is a dead-end click.
          if (item.href && item.value > 0) {
            return (
              <Link key={idx} to={item.href} className={styles.summaryCellLink}>
                {cell}
              </Link>
            );
          }
          return <div key={idx}>{cell}</div>;
        })}
      </div>
    </Card>
  );
}

function tonalColor(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'danger';
    case 'info':
      return 'info';
    default:
      return 'text';
  }
}
