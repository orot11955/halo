import { Card } from '@/components/ui/Card';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { DataTable, type Column } from '@/components/table/DataTable';
import { useServiceList } from '@/hooks/useServices';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import type { Service } from '@/types/service';

export function ServiceDependencies() {
  const t = useT();
  const query = useServiceList();

  const upstreamFor = (s: Service): string[] => {
    const all = query.data ?? [];
    if (s.kind === 'web') return all.filter((x) => x.kind === 'database').map((x) => x.name);
    if (s.kind === 'database') return [];
    return all.filter((x) => x.kind === 'web' || x.kind === 'proxy').map((x) => x.name);
  };

  const columns: Column<Service>[] = [
    {
      key: 'service',
      header: t('services.dependencies.col.service'),
      render: (s) => <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{s.name}</span>,
    },
    {
      key: 'node',
      header: t('services.dependencies.col.node'),
      render: (s) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="nodes" size={12} style={{ color: 'var(--color-text-subtle)' }} />
          <span className="code">{s.node}</span>
        </span>
      ),
    },
    {
      key: 'domain',
      header: t('services.dependencies.col.domain'),
      render: (s) =>
        s.domain ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="globe" size={12} style={{ color: 'var(--color-text-subtle)' }} />
            <span className="code">{s.domain}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ),
    },
    {
      key: 'upstream',
      header: t('services.dependencies.col.upstream'),
      render: (s) => {
        const ups = upstreamFor(s);
        if (ups.length === 0)
          return <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ups.slice(0, 4).map((u) => (
              <span
                key={u}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  padding: '1px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-hover)',
                }}
              >
                {u}
              </span>
            ))}
            {ups.length > 4 && (
              <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
                +{ups.length - 4}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card title={t('services.tab.dependencies')} subtitle={t('services.dependencies.subtitle')} flush>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('services.empty.title')}
      >
        {(rows) => <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} />}
      </QueryBoundary>
    </Card>
  );
}
