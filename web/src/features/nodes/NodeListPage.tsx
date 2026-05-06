import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput, Toolbar, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/table/DataTable';
import { NodeStatusBadge } from '@/components/status/NodeStatusBadge';
import { UsageBar } from '@/components/ui/UsageBar';
import { useDeleteNode, useNodeList, useRefreshNode } from '@/hooks/useNodes';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { useFilteredList } from '@/hooks/useFilteredList';
import { timeAgo } from '@/utils/date';
import { formatUptime } from '@/utils/format';
import { useT } from '@/i18n';
import type { Node } from '@/types/node';
import { NodeFormModal } from './NodeFormModal';

export function NodeListPage() {
  const t = useT();
  const navigate = useNavigate();
  const query = useNodeList();
  const refresh = useRefreshNode();
  const del = useDeleteNode();
  const [addOpen, setAddOpen] = useState(false);

  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();

  const onDelete = async (node: Node) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('nodes.confirm.delete').replace('{name}', node.name),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(node.name);
      toast.success(t('common.deleted'), node.name);
    } catch (err) {
      toast.error(err);
    }
  };

  const onRefresh = (node: Node) => {
    refresh.mutate(node.name, {
      onSuccess: () => toast.success(t('nodes.action.refresh'), node.name),
      onError: (err) => toast.error(err),
    });
  };

  const filtered = useFilteredList<Node>(query.data, {
    searchFields: ['name', 'display_name', 'hostname', 'ip'],
    initialFilters: { status: 'all' },
    urlSync: true,
  });

  const filterOptions = [
    { value: 'all', label: t('nodes.filter.all') },
    { value: 'online', label: t('nodes.filter.online') },
    { value: 'warning', label: t('nodes.filter.warning') },
    { value: 'offline', label: t('nodes.filter.offline') },
  ];

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
    {
      key: 'os',
      header: t('nodes.col.os'),
      render: (n) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {n.os} · {n.arch}
        </span>
      ),
    },
    { key: 'ip', header: t('nodes.col.ip'), render: (n) => <span className="code">{n.ip}</span> },
    {
      key: 'cpu',
      header: t('nodes.col.cpu'),
      width: '160px',
      render: (n) => <UsageBar percent={n.cpu_used_percent} />,
    },
    {
      key: 'memory',
      header: t('nodes.col.memory'),
      width: '160px',
      render: (n) => <UsageBar percent={n.memory_used_percent} />,
    },
    {
      key: 'disk',
      header: t('nodes.col.disk'),
      width: '160px',
      render: (n) => <UsageBar percent={n.disk_used_percent} />,
    },
    {
      key: 'uptime',
      header: t('nodes.col.uptime'),
      align: 'right',
      render: (n) => (
        <span style={{ color: 'var(--color-text-muted)' }}>{formatUptime(n.uptime_seconds)}</span>
      ),
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
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (n) => (
        <span style={{ display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRefresh(n)}
            disabled={refresh.isPending}
            aria-label={t('nodes.action.refresh')}
            title={t('nodes.action.refresh')}
          >
            <Icon name="refresh" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(n)}
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
    <Page title={t('nodes.title')}>
      <PageHeader
        title={t('nodes.title')}
        subtitle={t('nodes.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={14} />
            {t('nodes.action.add')}
          </Button>
        }
      />
      <NodeFormModal open={addOpen} onClose={() => setAddOpen(false)} />

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
              placeholder={t('nodes.search')}
            />
            <Segmented
              value={filtered.filters.status ?? 'all'}
              onChange={(v) => filtered.setFilter('status', v)}
              options={filterOptions}
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
          emptyTitle={t('nodes.empty.title')}
          emptyDetail={t('nodes.empty.detail')}
        >
          {() => (
            <DataTable
              rows={filtered.data}
              columns={columns}
              rowKey={(n) => n.name}
              onRowClick={(n) => navigate(`/nodes/${n.name}`)}
              emptyMessage={t('nodes.empty.detail')}
            />
          )}
        </QueryBoundary>
      </Card>
    </Page>
  );
}
