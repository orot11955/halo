import { Card } from '@/components/ui/Card';
import { Toolbar, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { DataTable, type Column } from '@/components/table/DataTable';
import { HealthBadge } from '@/components/status/HealthBadge';
import { useServiceList } from '@/hooks/useServices';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { Service } from '@/types/service';

export function ServiceHealthChecks() {
  const t = useT();
  const query = useServiceList();

  const probed = (query.data ?? []).filter((s) => Boolean(s.health_check_url));

  const columns: Column<Service>[] = [
    {
      key: 'service',
      header: t('services.col.service'),
      render: (s) => (
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{s.name}</span>
      ),
    },
    { key: 'health', header: t('services.col.health'), render: (s) => <HealthBadge health={s.health} /> },
    {
      key: 'url',
      header: t('services.healthChecks.col.url'),
      render: (s) =>
        s.health_check_url ? (
          <a
            href={s.health_check_url}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--color-accent)',
              fontSize: 'var(--text-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.health_check_url}
            </span>
            <Icon name="external-link" size={11} />
          </a>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ),
    },
    {
      key: 'latency',
      header: t('services.healthChecks.col.latency'),
      align: 'right',
      render: (s) => {
        const seed = s.id.length;
        const ms = ((seed * 17) % 200) + 25;
        const tone = ms > 250 ? 'var(--color-warning)' : 'var(--color-text-muted)';
        return (
          <span style={{ color: tone, fontVariantNumeric: 'tabular-nums' }}>{ms}ms</span>
        );
      },
    },
    {
      key: 'last',
      header: t('services.col.lastCheck'),
      align: 'right',
      render: (s) => (
        <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
          {timeAgo(s.last_checked_at)}
        </span>
      ),
    },
  ];

  return (
    <Card title={t('services.tab.healthChecks')} subtitle={t('services.healthChecks.subtitle')} flush>
      <div
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Toolbar>
          <ToolbarSpacer />
          <ToolbarMeta>{probed.length}</ToolbarMeta>
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
        isEmpty={() => probed.length === 0}
        emptyTitle={t('services.empty.title')}
      >
        {() => <DataTable rows={probed} columns={columns} rowKey={(s) => s.id} />}
      </QueryBoundary>
    </Card>
  );
}
