import { Card } from '@/components/ui/Card';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { useImpact } from '@/hooks/useTopology';
import { useT } from '@/i18n';
import styles from './topology.module.css';

export function ImpactView() {
  const t = useT();
  const query = useImpact();

  return (
    <Card title={t('topology.tab.impact')} subtitle={t('topology.impact.subtitle')} flush>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('topology.empty.assets')}
      >
        {(items) => (
          <div className={styles.impactList}>
            <div
              className={styles.impactRow}
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-subtle)',
                fontSize: 'var(--text-xs)',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              <span>{t('topology.impact.col.asset')}</span>
              <span>{t('topology.impact.col.services')}</span>
              <span>{t('topology.impact.col.domains')}</span>
              <span>{t('topology.impact.col.nodes')}</span>
            </div>
            {items.map((row) => (
              <div key={row.asset_id} className={styles.impactRow}>
                <div className={styles.impactAsset}>
                  <span className={styles.impactAssetName}>{row.asset_name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
                    {row.asset_id}
                  </span>
                </div>
                <TagList items={row.affected_services} />
                <TagList items={row.affected_domains} />
                <TagList items={row.affected_nodes} />
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
    </Card>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span style={{ color: 'var(--color-text-subtle)' }}>—</span>;
  }
  return (
    <div className={styles.tagWrap}>
      {items.map((it) => (
        <span key={it} className={styles.tag}>
          {it}
        </span>
      ))}
    </div>
  );
}
