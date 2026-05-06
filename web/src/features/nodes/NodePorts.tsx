import { Card } from '@/components/ui/Card';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { EmptyState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/table/DataTable';
import { usePorts } from '@/hooks/usePorts';
import { useFilteredList } from '@/hooks/useFilteredList';
import { isFeatureDisabledError } from '@/services/apiClient';
import { useT } from '@/i18n';
import type { NodePort, PortVisibility } from '@/types/port';

const VIS_TONE: Record<PortVisibility, 'danger' | 'warning' | 'neutral'> = {
  public: 'danger',
  private: 'warning',
  localhost: 'neutral',
};

const VIS_LABEL_KEY: Record<PortVisibility, 'ports.visibility.public' | 'ports.visibility.private' | 'ports.visibility.localhost'> = {
  public: 'ports.visibility.public',
  private: 'ports.visibility.private',
  localhost: 'ports.visibility.localhost',
};

export function NodePorts({ name }: { name: string }) {
  const t = useT();
  const query = usePorts(name);
  const filtered = useFilteredList<NodePort>(query.data, {
    searchFields: ['process', 'linked_service', 'bind_address'],
    initialFilters: { scope: 'all' },
  });

  const visible = (filtered.data ?? []).filter((p) => {
    const scope = filtered.filters.scope ?? 'all';
    if (scope === 'public') return p.visibility === 'public';
    if (scope === 'unregistered') return !p.registered;
    return true;
  });

  const columns: Column<NodePort>[] = [
    {
      key: 'port',
      header: t('ports.col.port'),
      width: '90px',
      render: (p) => (
        <span className="code" style={{ color: 'var(--color-text)' }}>
          {p.port}
        </span>
      ),
    },
    {
      key: 'protocol',
      header: t('ports.col.protocol'),
      width: '90px',
      render: (p) => (
        <StatusBadge tone="info" variant="solid">
          {p.protocol.toUpperCase()}
        </StatusBadge>
      ),
    },
    {
      key: 'bind',
      header: t('ports.col.bind'),
      render: (p) => <span className="code">{p.bind_address}</span>,
    },
    {
      key: 'process',
      header: t('ports.col.process'),
      render: (p) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {p.process}
          {p.pid && (
            <span style={{ color: 'var(--color-text-subtle)' }}> · {p.pid}</span>
          )}
        </span>
      ),
    },
    {
      key: 'service',
      header: t('ports.col.service'),
      render: (p) =>
        p.linked_service ? (
          <span className="code">{p.linked_service}</span>
        ) : (
          <StatusBadge tone="warning" dot>
            {t('ports.unregistered')}
          </StatusBadge>
        ),
    },
    {
      key: 'visibility',
      header: t('ports.col.visibility'),
      render: (p) => (
        <StatusBadge tone={VIS_TONE[p.visibility]} dot>
          {t(VIS_LABEL_KEY[p.visibility])}
        </StatusBadge>
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
            placeholder={t('ports.search')}
          />
          <Segmented
            value={filtered.filters.scope ?? 'all'}
            onChange={(v) => filtered.setFilter('scope', v)}
            options={[
              { value: 'all', label: t('ports.filter.all') },
              { value: 'public', label: t('ports.filter.public') },
              { value: 'unregistered', label: t('ports.filter.unregistered') },
            ]}
          />
          <ToolbarSpacer />
          <ToolbarMeta>
            {visible.length} / {filtered.total}
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
          title={t('ports.disabled.title')}
          detail={t('ports.disabled.detail')}
        />
      ) : (
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          data={query.data}
          isEmpty={(d) => d.length === 0}
          emptyTitle={t('ports.empty.title')}
        >
          {() => (
            <DataTable
              rows={visible}
              columns={columns}
              rowKey={(p) => `${p.protocol}-${p.port}-${p.bind_address}`}
            />
          )}
        </QueryBoundary>
      )}
    </Card>
  );
}
