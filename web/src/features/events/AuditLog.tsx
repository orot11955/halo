import { Card } from '@/components/ui/Card';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useAuditLog } from '@/hooks/useAudit';
import { useFilteredList } from '@/hooks/useFilteredList';
import { formatDateTime, timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import type { AuditAction, AuditEntry } from '@/types/audit';

const ACTION_LABEL_KEY: Record<AuditAction, TranslationKey> = {
  'token.issued': 'audit.action.token.issued',
  'token.revoked': 'audit.action.token.revoked',
  'service.registered': 'audit.action.service.registered',
  'service.deleted': 'audit.action.service.deleted',
  'domain.added': 'audit.action.domain.added',
  'domain.removed': 'audit.action.domain.removed',
  'node.enrolled': 'audit.action.node.enrolled',
  'log_source.added': 'audit.action.log_source.added',
  'maintenance.start': 'audit.action.maintenance.start',
  'maintenance.end': 'audit.action.maintenance.end',
};

const ACTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  'token.issued': 'info',
  'token.revoked': 'warning',
  'service.registered': 'success',
  'service.deleted': 'danger',
  'domain.added': 'success',
  'domain.removed': 'danger',
  'node.enrolled': 'success',
  'log_source.added': 'info',
  'maintenance.start': 'warning',
  'maintenance.end': 'success',
};

export function AuditLog() {
  const t = useT();
  const query = useAuditLog();
  const filtered = useFilteredList<AuditEntry>(query.data, {
    searchFields: ['actor', 'target', 'detail', 'action'],
  });

  const columns: Column<AuditEntry>[] = [
    {
      key: 'action',
      header: t('audit.col.action'),
      render: (e) => (
        <StatusBadge tone={ACTION_TONE[e.action] ?? 'neutral'} variant="solid">
          {t(ACTION_LABEL_KEY[e.action] ?? 'common.dash')}
        </StatusBadge>
      ),
    },
    {
      key: 'actor',
      header: t('audit.col.actor'),
      render: (e) => <span className="code">{e.actor}</span>,
    },
    {
      key: 'target',
      header: t('audit.col.target'),
      render: (e) => <span className="code">{e.target}</span>,
    },
    {
      key: 'detail',
      header: t('audit.col.detail'),
      render: (e) => (
        <span style={{ color: 'var(--color-text-muted)' }}>{e.detail ?? t('common.dash')}</span>
      ),
    },
    {
      key: 'time',
      header: t('audit.col.time'),
      align: 'right',
      render: (e) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>{timeAgo(e.ts)}</span>
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
            {formatDateTime(e.ts)}
          </span>
        </div>
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
            placeholder={t('common.search')}
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
        emptyTitle={t('audit.empty.title')}
      >
        {() => <DataTable rows={filtered.data} columns={columns} rowKey={(e) => e.id} />}
      </QueryBoundary>
    </Card>
  );
}
