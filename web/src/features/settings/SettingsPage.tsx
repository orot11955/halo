import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/ui/Grid';
import { Descriptions } from '@/components/ui/Descriptions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';
import { TokenIssueModal } from './TokenIssueModal';
import { AccountPane } from './AccountPane';
import { DataTable, type Column } from '@/components/table/DataTable';
import { NodeStatusBadge } from '@/components/status/NodeStatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { useNodeList } from '@/hooks/useNodes';
import { useAllLogSources } from '@/hooks/useLogs';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { Node } from '@/types/node';
import type { LogSource } from '@/types/log';

type SettingsTab =
  | 'account'
  | 'general'
  | 'nodes'
  | 'tokens'
  | 'retention'
  | 'checks'
  | 'logSources'
  | 'notifications';

export function SettingsPage() {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>('account');

  return (
    <Page title={t('settings.title')}>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Tabs<SettingsTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'account', label: t('settings.tab.account') },
          { value: 'general', label: t('settings.tab.general') },
          { value: 'nodes', label: t('settings.tab.nodes') },
          { value: 'tokens', label: t('settings.tab.tokens') },
          { value: 'checks', label: t('settings.tab.checks') },
          { value: 'logSources', label: t('settings.tab.logSources') },
          { value: 'notifications', label: t('settings.tab.notifications') },
          { value: 'retention', label: t('settings.tab.retention') },
        ]}
      />

      {tab === 'account' && <AccountPane />}
      {tab === 'general' && <GeneralPane />}
      {tab === 'nodes' && <NodesPane />}
      {tab === 'tokens' && <TokensPane />}
      {tab === 'retention' && <RetentionPane />}
      {tab === 'checks' && <ChecksPane />}
      {tab === 'logSources' && <LogSourcesPane />}
      {tab === 'notifications' && <NotificationsPane />}
    </Page>
  );
}

function GeneralPane() {
  const t = useT();
  return (
    <Grid cols={2}>
      <Card title={t('settings.polling.title')} subtitle={t('settings.polling.subtitle')}>
        <Descriptions
          items={[
            { label: t('settings.polling.heartbeat'), value: '15s' },
            { label: t('settings.polling.metricsStep'), value: '30s' },
            { label: t('settings.polling.domain'), value: '5m' },
            { label: t('settings.polling.ssl'), value: '6h' },
            { label: t('settings.polling.service'), value: '30s' },
          ]}
        />
      </Card>

      <Card title={t('settings.haloc.title')} subtitle={t('settings.haloc.subtitle')}>
        <Descriptions
          items={[
            { label: t('settings.haloc.version'), value: <span className="code">haloc 0.3.1</span> },
            { label: t('settings.haloc.listen'), value: <span className="code">0.0.0.0:7310</span> },
            {
              label: t('settings.haloc.storage'),
              value: <span className="code">sqlite · /var/lib/halo/halo.db</span>,
            },
            { label: t('settings.haloc.stream'), value: <StatusBadge tone="success">live</StatusBadge> },
          ]}
        />
      </Card>
    </Grid>
  );
}

function RetentionPane() {
  const t = useT();
  return (
    <Card title={t('settings.retention.title')} subtitle={t('settings.retention.subtitle')}>
      <Descriptions
        items={[
          { label: t('settings.retention.metrics'), value: '7 days' },
          { label: t('settings.retention.metricsRollups'), value: '90 days' },
          { label: t('settings.retention.events'), value: '30 days' },
          { label: t('settings.retention.audit'), value: '180 days' },
        ]}
      />
    </Card>
  );
}

function TokensPane() {
  const t = useT();
  const [issueOpen, setIssueOpen] = useState(false);
  const query = useNodeList();

  const columns: Column<Node>[] = [
    {
      key: 'node',
      header: t('settings.tokens.col.node'),
      render: (n) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{n.display_name}</span>
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>{n.name}</span>
        </div>
      ),
    },
    {
      key: 'token',
      header: t('settings.tokens.col.state'),
      render: (n) =>
        n.has_token ? (
          <StatusBadge tone="success" dot>
            {t('settings.tokens.issued')}
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning" dot>
            {t('settings.tokens.missing')}
          </StatusBadge>
        ),
    },
    {
      key: 'reachable',
      header: t('nodes.col.status'),
      render: (n) => <NodeStatusBadge status={n.status} />,
    },
    {
      key: 'last_seen',
      header: t('nodes.col.lastSeen'),
      align: 'right',
      render: (n) => (
        <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
          {timeAgo(n.last_seen_at)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title={t('settings.tokens.title')}
      subtitle={t('settings.tokens.subtitle')}
      actions={
        <Button size="sm" variant="primary" onClick={() => setIssueOpen(true)}>
          <Icon name="key" size={12} />
          {t('settings.tokens.issue')}
        </Button>
      }
      flush
    >
      <TokenIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} />
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('nodes.empty.title')}
        emptyDetail={t('settings.tokens.emptyDetail')}
      >
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(n) => n.name} />}
      </QueryBoundary>
    </Card>
  );
}

function NodesPane() {
  const t = useT();
  const query = useNodeList();

  const columns: Column<Node>[] = [
    {
      key: 'name',
      header: t('nodes.col.node'),
      render: (n) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{n.display_name}</span>
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
            {n.name} · {n.hostname}
          </span>
        </div>
      ),
    },
    { key: 'status', header: t('nodes.col.status'), render: (n) => <NodeStatusBadge status={n.status} /> },
    { key: 'ip', header: t('nodes.col.ip'), render: (n) => <span className="code">{n.ip}</span> },
    {
      key: 'os',
      header: t('nodes.col.os'),
      render: (n) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {n.os} · {n.arch}
        </span>
      ),
    },
    {
      key: 'version',
      header: t('nodes.col.version'),
      render: (n) => <span className="code">{n.version}</span>,
    },
    {
      key: 'last_seen',
      header: t('nodes.col.lastSeen'),
      align: 'right',
      render: (n) => (
        <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
          {timeAgo(n.last_seen_at)}
        </span>
      ),
    },
  ];

  return (
    <Card title={t('settings.nodes.title')} subtitle={t('settings.nodes.subtitle')} flush>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('nodes.empty.title')}
      >
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(n) => n.name} />}
      </QueryBoundary>
    </Card>
  );
}

function ChecksPane() {
  const t = useT();
  return (
    <Card title={t('settings.checks.title')} subtitle={t('settings.checks.subtitle')}>
      <Descriptions
        items={[
          { label: t('settings.checks.cpuWarn'), value: <span className="code">80%</span> },
          { label: t('settings.checks.cpuCritical'), value: <span className="code">95%</span> },
          { label: t('settings.checks.diskWarn'), value: <span className="code">85%</span> },
          { label: t('settings.checks.diskCritical'), value: <span className="code">95%</span> },
          { label: t('settings.checks.sslWarn'), value: <span className="code">14d</span> },
          { label: t('settings.checks.heartbeatTimeout'), value: <span className="code">45s</span> },
        ]}
      />
    </Card>
  );
}

function LogSourcesPane() {
  const t = useT();
  const query = useAllLogSources();

  const columns: Column<LogSource>[] = [
    {
      key: 'source',
      header: t('settings.logSources.col.source'),
      render: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{s.name}</span>
          {s.description && (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              {s.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'node',
      header: t('settings.logSources.col.node'),
      render: (s) => <span className="code">{s.node}</span>,
    },
    {
      key: 'kind',
      header: t('settings.logSources.col.kind'),
      render: (s) => (
        <StatusBadge tone="info" variant="solid">
          {t(`logs.kind.${s.kind}` as `logs.kind.systemd`)}
        </StatusBadge>
      ),
    },
    {
      key: 'target',
      header: t('settings.logSources.col.target'),
      render: (s) => <span className="code">{s.target}</span>,
    },
  ];

  return (
    <Card title={t('settings.logSources.title')} subtitle={t('settings.logSources.subtitle')} flush>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('settings.logSources.empty')}
      >
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} />}
      </QueryBoundary>
    </Card>
  );
}

interface NotificationChannel {
  id: string;
  channel: string;
  target: string;
  minSeverity: 'info' | 'warning' | 'critical';
  active: boolean;
}

const MOCK_CHANNELS: NotificationChannel[] = [
  { id: 'ch-slack', channel: 'Slack', target: '#home-ops', minSeverity: 'warning', active: true },
  { id: 'ch-email', channel: 'Email', target: 'orot+halo@example.com', minSeverity: 'critical', active: true },
  { id: 'ch-discord', channel: 'Discord', target: 'webhook://halo-alerts', minSeverity: 'warning', active: false },
];

function NotificationsPane() {
  const t = useT();

  const columns: Column<NotificationChannel>[] = [
    {
      key: 'channel',
      header: t('settings.notifications.col.channel'),
      render: (c) => (
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{c.channel}</span>
      ),
    },
    {
      key: 'target',
      header: t('settings.notifications.col.target'),
      render: (c) => <span className="code">{c.target}</span>,
    },
    {
      key: 'severity',
      header: t('settings.notifications.col.severity'),
      render: (c) => (
        <StatusBadge
          tone={c.minSeverity === 'critical' ? 'danger' : c.minSeverity === 'warning' ? 'warning' : 'info'}
          variant="solid"
        >
          {t(`severity.${c.minSeverity}` as `severity.info`)}
        </StatusBadge>
      ),
    },
    {
      key: 'state',
      header: t('settings.notifications.col.state'),
      render: (c) =>
        c.active ? (
          <StatusBadge tone="success" dot>
            {t('settings.tokens.active')}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot>
            {t('stream.idle')}
          </StatusBadge>
        ),
    },
  ];

  return (
    <Card
      title={t('settings.notifications.title')}
      subtitle={t('settings.notifications.subtitle')}
      flush
    >
      <DataTable rows={MOCK_CHANNELS} columns={columns} rowKey={(c) => c.id} />
    </Card>
  );
}
