import { useState } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Icon } from '@/components/ui/Icon';
import { useCheckDomain, useDeleteDomain } from '@/hooks/useDomains';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { DomainFormModal } from './DomainFormModal';
import { DataTable, type Column } from '@/components/table/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDomainList } from '@/hooks/useDomains';
import { useFilteredList } from '@/hooks/useFilteredList';
import { domainStatusTone } from '@/utils/status';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import type { Domain } from '@/types/domain';

const STATUS_LABEL_KEY: Record<Domain['status'], TranslationKey> = {
  ok: 'domains.status.ok',
  warning: 'domains.status.warning',
  error: 'domains.status.error',
};

export function DomainsPage() {
  const t = useT();
  const query = useDomainList();
  const check = useCheckDomain();
  const del = useDeleteDomain();
  const [addOpen, setAddOpen] = useState(false);

  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();

  const onDelete = async (d: Domain) => {
    const ok = await confirmDelete({
      title: t('common.delete'),
      description: t('domains.confirm.delete').replace('{name}', d.domain),
    });
    if (!ok) return;
    try {
      await del.mutateAsync(d.domain);
      toast.success(t('common.deleted'), d.domain);
    } catch (err) {
      toast.error(err);
    }
  };

  const onCheck = (d: Domain) => {
    check.mutate(d.domain, {
      onSuccess: () => toast.success(t('domains.action.check'), d.domain),
      onError: (err) => toast.error(err),
    });
  };
  const filtered = useFilteredList<Domain>(query.data, {
    searchFields: ['domain'],
    initialFilters: { status: 'all' },
    urlSync: true,
  });

  const statusFilter = [
    { value: 'all', label: t('domains.filter.all') },
    { value: 'ok', label: t('domains.filter.ok') },
    { value: 'warning', label: t('domains.filter.warning') },
    { value: 'error', label: t('domains.filter.error') },
  ];

  const columns: Column<Domain>[] = [
    {
      key: 'domain',
      header: t('domains.col.domain'),
      render: (d) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="code" style={{ color: 'var(--color-text)' }}>
            {d.domain}
          </span>
          {d.ssl_issuer && (
            <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
              <Icon name="shield" size={10} style={{ marginRight: 4, verticalAlign: '-1px' }} />
              {d.ssl_issuer}
            </span>
          )}
          {d.error_message && (
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>
              {d.error_message}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('domains.col.status'),
      render: (d) => (
        <StatusBadge tone={domainStatusTone(d.status)} dot>
          {t(STATUS_LABEL_KEY[d.status])}
        </StatusBadge>
      ),
    },
    {
      key: 'http',
      header: t('domains.col.http'),
      align: 'right',
      render: (d) => formatHttp(d.http_status),
    },
    {
      key: 'https',
      header: t('domains.col.https'),
      align: 'right',
      render: (d) => formatHttp(d.https_status),
    },
    {
      key: 'rt',
      header: t('domains.col.response'),
      align: 'right',
      render: (d) =>
        d.response_time_ms == null ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ) : (
          <span
            style={{
              color: d.response_time_ms > 1000 ? 'var(--color-warning)' : 'var(--color-text-muted)',
            }}
          >
            {d.response_time_ms}ms
          </span>
        ),
    },
    {
      key: 'resolved',
      header: t('domains.col.resolved'),
      render: (d) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="code">{d.resolved_ips.join(', ') || t('common.dash')}</span>
          {d.expected_ip && d.resolved_ips[0] !== d.expected_ip && (
            <span style={{ color: 'var(--color-warning)', fontSize: 'var(--text-xs)' }}>
              {t('domains.expectedIp', { ip: d.expected_ip })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'ssl',
      header: t('domains.col.ssl'),
      align: 'right',
      render: (d) => {
        if (d.days_remaining == null)
          return <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>;
        const tone =
          d.days_remaining <= 14 ? 'warning' : d.days_remaining <= 30 ? 'info' : 'neutral';
        return (
          <StatusBadge tone={tone}>{t('domains.daysShort', { days: d.days_remaining })}</StatusBadge>
        );
      },
    },
    {
      key: 'last_check',
      header: t('domains.col.lastCheck'),
      align: 'right',
      render: (d) => (
        <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
          {timeAgo(d.last_checked_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) => (
        <span style={{ display: 'inline-flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCheck(d)}
            disabled={check.isPending}
            aria-label={t('domains.action.check')}
            title={t('domains.action.check')}
          >
            <Icon name="activity" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(d)}
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
    <Page title={t('domains.title')}>
      <PageHeader
        title={t('domains.title')}
        subtitle={t('domains.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={14} />
            {t('domains.action.add')}
          </Button>
        }
      />
      <DomainFormModal open={addOpen} onClose={() => setAddOpen(false)} />

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
              placeholder={t('domains.search')}
            />
            <Segmented
              value={filtered.filters.status ?? 'all'}
              onChange={(v) => filtered.setFilter('status', v)}
              options={statusFilter}
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
          emptyTitle={t('domains.empty.title')}
        >
          {() => (
            <DataTable
              rows={filtered.data}
              columns={columns}
              rowKey={(d) => d.domain}
              emptyMessage={t('state.empty.adjustFilters')}
            />
          )}
        </QueryBoundary>
      </Card>
    </Page>
  );
}

function formatHttp(code?: number) {
  if (code == null)
    return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
  const tone = code >= 500 ? 'danger' : code >= 400 ? 'warning' : code >= 300 ? 'info' : 'success';
  return (
    <StatusBadge tone={tone} variant="solid">
      {code}
    </StatusBadge>
  );
}
