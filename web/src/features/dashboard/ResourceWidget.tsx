import { Card } from '@/components/ui/Card';
import { UsageBar } from '@/components/ui/UsageBar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import styles from './widgets.module.css';

interface ResourceWidgetProps {
  cpuAvg: number;
  memoryAvg: number;
  diskMax: number;
}

export function ResourceWidget({ cpuAvg, memoryAvg, diskMax }: ResourceWidgetProps) {
  const t = useT();
  return (
    <Card
      title={
        <span className={styles.titleWithIcon}>
          <span className={styles.titleIcon}>
            <Icon name="activity" size={14} />
          </span>
          {t('dashboard.card.resources')}
        </span>
      }
      subtitle={t('dashboard.card.resources.subtitle')}
      widgetId="dashboard.resources"
    >
      <div className={styles.resourceRow}>
        <Item icon="cpu" label={t('dashboard.card.resources.cpu')} percent={cpuAvg} />
        <Item icon="memory" label={t('dashboard.card.resources.memory')} percent={memoryAvg} />
        <Item icon="disk" label={t('dashboard.card.resources.disk')} percent={diskMax} />
      </div>
    </Card>
  );
}

function Item({ icon, label, percent }: { icon: IconName; label: string; percent: number }) {
  return (
    <div className={styles.resourceItem}>
      <div className={styles.resourceLabel}>
        <Icon name={icon} size={14} className={styles.resourceIcon} />
        <span>{label}</span>
      </div>
      <UsageBar percent={percent} />
    </div>
  );
}
