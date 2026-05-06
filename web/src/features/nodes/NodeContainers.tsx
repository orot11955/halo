import { Card } from '@/components/ui/Card';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { EmptyState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/table/DataTable';
import { UsageBar } from '@/components/ui/UsageBar';
import { useContainers } from '@/hooks/useContainers';
import { useFilteredList } from '@/hooks/useFilteredList';
import { isFeatureDisabledError } from '@/services/apiClient';
import { formatBytes, formatUptime } from '@/utils/format';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import type { Container, ContainerState } from '@/types/container';

const STATE_TONE: Record<ContainerState, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  running: 'success',
  restarting: 'warning',
  exited: 'danger',
  paused: 'neutral',
  created: 'info',
};

const STATE_LABEL_KEY: Record<ContainerState, TranslationKey> = {
  running: 'containers.state.running',
  restarting: 'containers.state.restarting',
  exited: 'containers.state.exited',
  paused: 'containers.state.paused',
  created: 'containers.state.created',
};

export function NodeContainers({ name }: { name: string }) {
  const t = useT();
  const query = useContainers(name);
  const filtered = useFilteredList<Container>(query.data, {
    searchFields: ['name', 'image', 'compose_project', 'linked_service'],
  });

  const columns: Column<Container>[] = [
    {
      key: 'name',
      header: t('containers.col.name'),
      render: (c) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{c.name}</span>
          {c.compose_project && (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              {c.compose_project}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'state',
      header: t('containers.col.state'),
      render: (c) => (
        <StatusBadge tone={STATE_TONE[c.state]} dot>
          {t(STATE_LABEL_KEY[c.state])}
        </StatusBadge>
      ),
    },
    {
      key: 'image',
      header: t('containers.col.image'),
      render: (c) => <span className="code">{c.image}</span>,
    },
    {
      key: 'ports',
      header: t('containers.col.ports'),
      render: (c) =>
        c.ports.length === 0 ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ) : (
          <span className="code" style={{ color: 'var(--color-text-muted)' }}>
            {c.ports.join(' · ')}
          </span>
        ),
    },
    {
      key: 'cpu',
      header: t('containers.col.cpu'),
      align: 'right',
      render: (c) =>
        c.cpu_percent == null ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ) : (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
            {c.cpu_percent.toFixed(1)}%
          </span>
        ),
    },
    {
      key: 'memory',
      header: t('containers.col.memory'),
      width: '180px',
      render: (c) => {
        if (c.memory_used_bytes == null || c.memory_limit_bytes == null) {
          return <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>;
        }
        const pct = c.memory_limit_bytes
          ? (c.memory_used_bytes / c.memory_limit_bytes) * 100
          : 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <UsageBar percent={pct} showValue={false} />
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              {formatBytes(c.memory_used_bytes)} / {formatBytes(c.memory_limit_bytes)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'restart',
      header: t('containers.col.restart'),
      align: 'right',
      render: (c) => (
        <span
          style={{
            color: c.restart_count > 5 ? 'var(--color-warning)' : 'var(--color-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {c.restart_count}
        </span>
      ),
    },
    {
      key: 'uptime',
      header: t('containers.col.uptime'),
      align: 'right',
      render: (c) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {c.uptime_seconds ? formatUptime(c.uptime_seconds) : t('common.dash')}
        </span>
      ),
    },
  ];

  return (
    <Card flush>
      <div
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Toolbar>
          <SearchInput
            value={filtered.search}
            onChange={filtered.setSearch}
            placeholder={t('containers.search')}
          />
          <ToolbarSpacer />
          <ToolbarMeta>
            {filtered.data.length} / {filtered.total}
          </ToolbarMeta>
          <Button size="sm" onClick={() => query.refetch()}>
            <Icon name="refresh" size={12} />
            {t('common.refresh')}
          </Button>
        </Toolbar>
      </div>
      {isFeatureDisabledError(query.error) ? (
        <EmptyState
          icon="lock"
          title={t('containers.disabled.title')}
          detail={t('containers.disabled.detail')}
        />
      ) : (
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          data={query.data}
          isEmpty={(d) => d.length === 0}
          emptyTitle={t('containers.empty.title')}
          emptyDetail={t('containers.empty.detail')}
        >
          {() => (
            <DataTable rows={filtered.data} columns={columns} rowKey={(c) => c.id} />
          )}
        </QueryBoundary>
      )}
    </Card>
  );
}
