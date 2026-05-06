import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useAssets, useDeleteAsset } from '@/hooks/useTopology';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { useFilteredList } from '@/hooks/useFilteredList';
import { useT } from '@/i18n';
import type { Asset, AssetKind, AssetStatus } from '@/types/topology';
import styles from './topology.module.css';
import { AssetFormModal } from './AssetFormModal';

const KIND_ICON: Record<AssetKind, IconName> = {
  internet: 'globe',
  router: 'globe',
  switch: 'network',
  access_point: 'network',
  server: 'nodes',
  nas: 'database',
  desktop: 'cpu',
  laptop: 'cpu',
  lxc: 'cpu',
  vm: 'cpu',
  docker_host: 'services',
  ups: 'shield',
  external_disk: 'disk',
  camera: 'info',
  monitor: 'info',
  patch_panel: 'network',
  kvm: 'cpu',
};

const STATUS_TONE: Record<AssetStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  warning: 'warning',
  offline: 'danger',
  unknown: 'neutral',
};

export function HardwareAssets() {
  const t = useT();
  const query = useAssets();
  const del = useDeleteAsset();
  const [addOpen, setAddOpen] = useState(false);
  const filtered = useFilteredList<Asset>(query.data, {
    searchFields: ['name', 'ip', 'description', 'linked_node'],
  });

  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();

  const onDelete = async (a: Asset) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('topology.confirm.delete').replace('{name}', a.name),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(a.id);
      toast.success(t('common.deleted'), a.name);
    } catch (err) {
      toast.error(err);
    }
  };

  const columns: Column<Asset>[] = [
    {
      key: 'asset',
      header: t('topology.assets.col.asset'),
      render: (a) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
            <Icon name={KIND_ICON[a.kind]} size={16} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{a.name}</span>
            {a.description && (
              <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
                {a.description}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: t('topology.assets.col.kind'),
      render: (a) => (
        <span className={styles.kindBadge}>
          <Icon name={KIND_ICON[a.kind]} size={12} />
          {t(`topology.kind.${a.kind}` as `topology.kind.server`)}
        </span>
      ),
    },
    {
      key: 'ip',
      header: t('topology.assets.col.ip'),
      render: (a) =>
        a.ip ? (
          <span className="code">{a.ip}</span>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ),
    },
    {
      key: 'linked',
      header: t('topology.assets.col.linked'),
      render: (a) =>
        a.linked_node ? (
          <span className="code">{a.linked_node}</span>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ),
    },
    {
      key: 'status',
      header: t('topology.assets.col.status'),
      render: (a) => (
        <StatusBadge tone={STATUS_TONE[a.status]} dot>
          {t(`topology.assetStatus.${a.status}` as `topology.assetStatus.ok`)}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(a)}
          disabled={del.isPending}
          aria-label={t('common.delete')}
        >
          <Icon name="x" size={14} />
        </Button>
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
            placeholder={t('topology.assets.search')}
          />
          <ToolbarSpacer />
          <ToolbarMeta>
            {filtered.data.length} / {filtered.total}
          </ToolbarMeta>
          <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={12} />
            {t('topology.action.addAsset')}
          </Button>
        </Toolbar>
      </div>
      <AssetFormModal open={addOpen} onClose={() => setAddOpen(false)} />
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('topology.empty.assets')}
      >
        {() => <DataTable rows={filtered.data} columns={columns} rowKey={(a) => a.id} />}
      </QueryBoundary>
    </Card>
  );
}
