import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/table/DataTable';
import { HealthBadge } from '@/components/status/HealthBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCheckService, useDeleteService, useServiceList } from '@/hooks/useServices';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { useFilteredList } from '@/hooks/useFilteredList';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { Service } from '@/types/service';

export function ServicesCatalog() {
  const t = useT();
  const query = useServiceList();
  const check = useCheckService();
  const del = useDeleteService();
  const filtered = useFilteredList<Service>(query.data, {
    searchFields: ['name', 'node', 'domain'],
    initialFilters: { health: 'all' },
    urlSync: true,
  });

  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();

  const onDelete = async (s: Service) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('services.confirm.delete').replace('{name}', s.name),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(s.id);
      toast.success(t('common.deleted'), s.name);
    } catch (err) {
      toast.error(err);
    }
  };

  const onCheck = (s: Service) => {
    check.mutate(s.id, {
      onSuccess: () => toast.success(t('services.action.check'), s.name),
      onError: (err) => toast.error(err),
    });
  };

  const healthFilter = [
    { value: 'all', label: t('services.filter.all') },
    { value: 'healthy', label: t('services.filter.healthy') },
    { value: 'warning', label: t('services.filter.warning') },
    { value: 'critical', label: t('services.filter.critical') },
    { value: 'unknown', label: t('services.filter.unknown') },
  ];

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: t('services.col.service'),
      render: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{s.name}</span>
          {s.description && (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              {s.description}
            </span>
          )}
        </div>
      ),
    },
    { key: 'health', header: t('services.col.health'), render: (s) => <HealthBadge health={s.health} /> },
    {
      key: 'kind',
      header: t('services.col.kind'),
      render: (s) => (
        <StatusBadge tone="info" variant="solid">
          {s.kind}
        </StatusBadge>
      ),
    },
    { key: 'node', header: t('services.col.node'), render: (s) => <span className="code">{s.node}</span> },
    {
      key: 'port',
      header: t('services.col.port'),
      align: 'right',
      render: (s) =>
        s.port == null ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ) : (
          <span className="code">{s.port}</span>
        ),
    },
    {
      key: 'domain',
      header: t('services.col.domain'),
      render: (s) =>
        s.domain ? (
          <span className="code">{s.domain}</span>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ),
    },
    {
      key: 'last_checked',
      header: t('services.col.lastCheck'),
      align: 'right',
      render: (s) => (
        <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
          {timeAgo(s.last_checked_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <span style={{ display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCheck(s)}
            disabled={check.isPending}
            aria-label={t('services.action.check')}
            title={t('services.action.check')}
          >
            <Icon name="activity" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(s)}
            disabled={del.isPending}
            aria-label={t('common.delete')}
            title={t('common.delete')}
          >
            <Icon name="x" size={14} />
          </Button>
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
            placeholder={t('services.search')}
          />
          <Segmented
            value={filtered.filters.health ?? 'all'}
            onChange={(v) => filtered.setFilter('health', v)}
            options={healthFilter}
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
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('services.empty.title')}
        emptyDetail={t('services.empty.detail')}
      >
        {() => (
          <DataTable
            rows={filtered.data}
            columns={columns}
            rowKey={(s) => s.id}
            emptyMessage={t('state.empty.adjustFilters')}
          />
        )}
      </QueryBoundary>
    </Card>
  );
}
