import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { SeverityBadge } from '@/components/status/SeverityBadge';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { timeAgo } from '@/utils/date';
import type { HaloEvent } from '@/types/event';
import styles from './widgets.module.css';

interface EventsWidgetProps {
  events: HaloEvent[];
  unresolved: number;
}

export function EventsWidget({ events, unresolved }: EventsWidgetProps) {
  const t = useT();
  return (
    <Card
      title={
        <span className={styles.titleWithIcon}>
          <span className={styles.titleIcon}>
            <Icon name="inbox" size={14} />
          </span>
          {t('dashboard.card.events')}
        </span>
      }
      subtitle={t('dashboard.card.events.unresolved', { count: unresolved })}
      flush
      widgetId="dashboard.events"
      actions={
        <Link to="/events" className={styles.linkAction}>
          {t('common.viewAll')}
          <Icon name="arrow-right" size={12} />
        </Link>
      }
    >
      {events.length === 0 ? (
        <div className={styles.empty}>{t('dashboard.card.events.empty')}</div>
      ) : (
        <div className={styles.eventList}>
          {events.map((event) => (
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
