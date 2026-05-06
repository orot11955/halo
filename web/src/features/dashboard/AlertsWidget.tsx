import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SeverityBadge } from '@/components/status/SeverityBadge';
import { useT } from '@/i18n';
import { timeAgo } from '@/utils/date';
import type { HaloEvent } from '@/types/event';
import styles from './widgets.module.css';

interface AlertsWidgetProps {
  events: HaloEvent[];
  unresolved: number;
}

export function AlertsWidget({ events, unresolved }: AlertsWidgetProps) {
  const t = useT();
  const open = events.filter((e) => !e.resolved && e.severity !== 'info').slice(0, 4);

  return (
    <Card
      title={
        <span className={styles.titleWithIcon}>
          <span className={styles.titleIcon}>
            <Icon name="alert" size={14} />
          </span>
          {t('dashboard.card.alerts')}
        </span>
      }
      subtitle={
        unresolved > 0
          ? t('dashboard.card.events.unresolved', { count: unresolved })
          : t('dashboard.card.alerts.subtitle')
      }
      flush
      widgetId="dashboard.alerts"
      actions={
        <Link to="/events?tab=alerts&severity=warning&state=unresolved" className={styles.linkAction}>
          {t('common.viewAll')}
          <Icon name="arrow-right" size={12} />
        </Link>
      }
    >
      {open.length === 0 ? (
        <div className={styles.alertsEmpty}>
          <span className={styles.alertsEmptyIcon}>
            <Icon name="check" size={16} />
          </span>
          <span>{t('dashboard.card.alerts.empty')}</span>
        </div>
      ) : (
        <div className={styles.eventList}>
          {open.map((event) => (
            <div key={event.id} className={styles.eventRow}>
              <SeverityBadge severity={event.severity} />
              <div>
                <div className={styles.eventSubject}>{event.subject}</div>
                <div className={styles.eventMessage}>{event.message}</div>
              </div>
              <div className={styles.eventTime}>{timeAgo(event.occurred_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
