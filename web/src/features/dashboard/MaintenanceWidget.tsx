import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useMaintenance } from '@/hooks/useAudit';
import { useT } from '@/i18n';
import { formatDateTime, timeAgo } from '@/utils/date';
import type { MaintenanceWindow } from '@/types/audit';
import styles from './widgets.module.css';

const STATE_TONE: Record<MaintenanceWindow['state'], 'info' | 'warning' | 'success'> = {
  scheduled: 'info',
  active: 'warning',
  completed: 'success',
};

export function MaintenanceWidget() {
  const t = useT();
  const query = useMaintenance();
  const all = query.data ?? [];
  // Show active first, then upcoming-soonest. Completed windows are
  // historical noise on the dashboard.
  const live = all
    .filter((m) => m.state !== 'completed')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);
  const activeCount = all.filter((m) => m.state === 'active').length;

  return (
    <Card
      title={
        <span className={styles.titleWithIcon}>
          <span className={styles.titleIcon}>
            <Icon name="clock" size={14} />
          </span>
          {t('dashboard.card.maintenance')}
        </span>
      }
      subtitle={
        activeCount > 0
          ? t('dashboard.card.maintenance.activeCount', { count: activeCount })
          : t('dashboard.card.maintenance.subtitle')
      }
      flush
      widgetId="dashboard.maintenance"
      actions={
        <Link to="/events" className={styles.linkAction}>
          {t('common.viewAll')}
          <Icon name="arrow-right" size={12} />
        </Link>
      }
    >
      {live.length === 0 ? (
        <div className={styles.alertsEmpty}>
          <span className={styles.alertsEmptyIcon}>
            <Icon name="check" size={16} />
          </span>
          <span>{t('dashboard.card.maintenance.empty')}</span>
        </div>
      ) : (
        <div className={styles.eventList}>
          {live.map((m) => (
            <div key={m.id} className={styles.eventRow}>
              <StatusBadge tone={STATE_TONE[m.state]} dot>
                {t(`maintenance.state.${m.state}` as `maintenance.state.scheduled`)}
              </StatusBadge>
              <div>
                <div className={styles.eventSubject}>{m.title}</div>
                <div className={styles.eventMessage}>
                  {formatDateTime(m.starts_at)} – {formatDateTime(m.ends_at)}
                </div>
              </div>
              <div className={styles.eventTime}>
                {m.state === 'active' ? t('dashboard.card.maintenance.now') : timeAgo(m.starts_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
