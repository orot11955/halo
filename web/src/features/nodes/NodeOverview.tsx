import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Descriptions } from '@/components/ui/Descriptions';
import { Grid } from '@/components/ui/Grid';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Stat } from '@/components/ui/Stat';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UsageBar } from '@/components/ui/UsageBar';
import { NodeStatusBadge } from '@/components/status/NodeStatusBadge';
import { formatUptime, formatPercent } from '@/utils/format';
import { formatDateTime, timeAgo } from '@/utils/date';
import { nodeStatusTone, usageTone, type Tone } from '@/utils/status';
import { useT, type TranslationKey } from '@/i18n';
import type { Node } from '@/types/node';
import styles from './NodeOverview.module.css';

export function NodeOverview({ node }: { node: Node }) {
  const t = useT();
  const maxUsage = Math.max(
    node.cpu_used_percent,
    node.memory_used_percent,
    node.disk_used_percent,
  );
  const resourceName =
    maxUsage === node.cpu_used_percent
      ? t('nodeDetail.triage.resource.cpu')
      : maxUsage === node.memory_used_percent
        ? t('nodeDetail.triage.resource.memory')
        : t('nodeDetail.triage.resource.disk');
  const needsAttention = node.status !== 'online' || maxUsage >= 70 || Boolean(node.error_message);

  return (
    <>
      <Grid cols={4}>
        <Card>
          <Stat
            label={t('nodeDetail.stat.cpu')}
            value={formatPercent(node.cpu_used_percent)}
            tone={usageTone(node.cpu_used_percent)}
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <UsageBar percent={node.cpu_used_percent} showValue={false} />
          </div>
        </Card>
        <Card>
          <Stat
            label={t('nodeDetail.stat.memory')}
            value={formatPercent(node.memory_used_percent)}
            tone={usageTone(node.memory_used_percent)}
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <UsageBar percent={node.memory_used_percent} showValue={false} />
          </div>
        </Card>
        <Card>
          <Stat
            label={t('nodeDetail.stat.disk')}
            value={formatPercent(node.disk_used_percent)}
            tone={usageTone(node.disk_used_percent)}
          />
          <div style={{ marginTop: 'var(--space-3)' }}>
            <UsageBar percent={node.disk_used_percent} showValue={false} />
          </div>
        </Card>
        <Card>
          <Stat
            label={t('nodeDetail.stat.uptime')}
            value={formatUptime(node.uptime_seconds)}
            tone="info"
          />
          <div
            style={{
              marginTop: 'var(--space-3)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-subtle)',
            }}
          >
            {t('common.lastSeen')} · {timeAgo(node.last_seen_at)}
          </div>
        </Card>
      </Grid>

      <Card
        title={t('nodeDetail.triage.title')}
        subtitle={
          needsAttention
            ? t('nodeDetail.triage.subtitle.attention')
            : t('nodeDetail.triage.subtitle.ok')
        }
      >
        <div className={styles.triage}>
          <div className={styles.signals}>
            <TriageSignal
              icon="activity"
              label={t('nodeDetail.triage.heartbeat')}
              tone={nodeStatusTone(node.status)}
              value={t(`status.node.${node.status}` as TranslationKey)}
              detail={t('nodeDetail.triage.lastSeen', { time: timeAgo(node.last_seen_at) })}
            />
            <TriageSignal
              icon="cpu"
              label={t('nodeDetail.triage.resources')}
              tone={usageTone(maxUsage)}
              value={formatPercent(maxUsage)}
              detail={t('nodeDetail.triage.highestUsage', { resource: resourceName })}
            />
            <TriageSignal
              icon="shield"
              label={t('nodeDetail.triage.agent')}
              tone={node.error_message ? 'danger' : 'info'}
              value={node.version}
              detail={`${node.os} · ${node.arch}`}
            />
          </div>
          <div className={styles.actions} aria-label={t('nodeDetail.triage.actions')}>
            <TriageLink
              to={`/events?source=${encodeURIComponent(node.name)}&range=24h`}
              icon="events"
            >
              {t('nodeDetail.triage.action.events')}
            </TriageLink>
            <TriageLink
              to={`/nodes/${encodeURIComponent(node.name)}/logs?level=warningPlus&range=1h`}
              icon="inbox"
            >
              {t('nodeDetail.triage.action.logs')}
            </TriageLink>
            <TriageLink
              to={`/nodes/${encodeURIComponent(node.name)}/metrics?range=1h`}
              icon="activity"
            >
              {t('nodeDetail.triage.action.metrics')}
            </TriageLink>
            <TriageLink to={`/nodes/${encodeURIComponent(node.name)}/ports`} icon="network">
              {t('nodeDetail.triage.action.ports')}
            </TriageLink>
          </div>
        </div>
      </Card>

      <Card title={t('nodeDetail.host.title')}>
        <Descriptions
          items={[
            { label: t('nodeDetail.host.name'), value: <span className="code">{node.name}</span> },
            { label: t('nodeDetail.host.displayName'), value: node.display_name },
            { label: t('nodeDetail.host.hostname'), value: <span className="code">{node.hostname}</span> },
            { label: t('nodeDetail.host.ip'), value: <span className="code">{node.ip}</span> },
            { label: t('nodeDetail.host.os'), value: node.os },
            { label: t('nodeDetail.host.arch'), value: node.arch },
            { label: t('nodeDetail.host.version'), value: <span className="code">{node.version}</span> },
            { label: t('nodeDetail.host.status'), value: <NodeStatusBadge status={node.status} /> },
            { label: t('nodeDetail.host.lastSeenAt'), value: formatDateTime(node.last_seen_at) },
          ]}
        />
      </Card>

      {node.error_message && (
        <div className={styles.nodeAlert}>
          <span className={styles.nodeAlertIcon}>
            <Icon name="alert" size={16} />
          </span>
          <span>
            <strong>{t('nodeDetail.alert.title')}</strong>
            <span>{node.error_message}</span>
          </span>
        </div>
      )}
    </>
  );
}

function TriageSignal({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className={styles.signal}>
      <div className={styles.signalIcon}>
        <Icon name={icon} size={14} />
      </div>
      <div className={styles.signalBody}>
        <div className={styles.signalLabel}>{label}</div>
        <div className={styles.signalValue}>
          <StatusBadge tone={tone} dot>
            {value}
          </StatusBadge>
        </div>
        <div className={styles.signalDetail}>{detail}</div>
      </div>
    </div>
  );
}

function TriageLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={styles.actionLink}>
      <Icon name={icon} size={14} />
      {children}
    </Link>
  );
}
