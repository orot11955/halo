import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useAuditLog } from '@/hooks/useAudit';
import { useT } from '@/i18n';
import { timeAgo } from '@/utils/date';
import styles from './widgets.module.css';

export function AuditWidget() {
  const t = useT();
  const query = useAuditLog();
  const recent = (query.data ?? []).slice(0, 6);

  return (
    <Card
      title={
        <span className={styles.titleWithIcon}>
          <span className={styles.titleIcon}>
            <Icon name="key" size={14} />
          </span>
          {t('dashboard.card.audit')}
        </span>
      }
      subtitle={t('dashboard.card.audit.subtitle')}
      flush
      widgetId="dashboard.audit"
      actions={
        <Link to="/events" className={styles.linkAction}>
          {t('common.viewAll')}
          <Icon name="arrow-right" size={12} />
        </Link>
      }
    >
      {recent.length === 0 ? (
        <div className={styles.empty}>{t('dashboard.card.audit.empty')}</div>
      ) : (
        <ul className={styles.auditList}>
          {recent.map((entry) => (
            <li key={entry.id} className={styles.auditRow}>
              <div className={styles.auditMain}>
                <span className={styles.auditAction}>{entry.action}</span>
                <span className={styles.auditTarget} title={entry.target}>
                  {entry.target}
                </span>
              </div>
              <div className={styles.auditMeta}>
                <span className={styles.auditActor}>{entry.actor}</span>
                <span className={styles.auditTime}>{timeAgo(entry.ts)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
