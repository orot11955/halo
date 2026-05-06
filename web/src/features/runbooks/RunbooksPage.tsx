import { useMemo, useState } from 'react';
import { Page } from '@/components/layout/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { useDeleteRunbook, useRunbooks } from '@/hooks/useRunbooks';
import { useConfirmDelete, useMutationToast } from '@/hooks/useDeleteAction';
import { RunbookFormModal } from './RunbookFormModal';
import { timeAgo } from '@/utils/date';
import { useT } from '@/i18n';
import type { Runbook, RunbookStatus } from '@/types/runbook';
import styles from './runbooks.module.css';

const STATUS_TONE: Record<RunbookStatus, 'success' | 'info' | 'warning'> = {
  verified: 'success',
  draft: 'info',
  stale: 'warning',
};

export function RunbooksPage() {
  const t = useT();
  const query = useRunbooks();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | RunbookStatus>('all');
  const [activeId, setActiveId] = useState<string | undefined>();
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false;
      if (!term) return true;
      return (
        b.title.toLowerCase().includes(term) ||
        b.summary.toLowerCase().includes(term) ||
        b.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [query.data, search, filter]);

  const active = filtered.find((b) => b.id === activeId) ?? filtered[0];

  return (
    <Page title={t('runbooks.title')}>
      <PageHeader
        title={t('runbooks.title')}
        subtitle={t('runbooks.subtitle')}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={14} />
            {t('runbooks.action.new')}
          </Button>
        }
      />
      <RunbookFormModal open={newOpen} onClose={() => setNewOpen(false)} />

      <Card flush>
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder={t('runbooks.search')} />
            <Segmented
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
              options={[
                { value: 'all', label: t('runbooks.filter.all') },
                { value: 'verified', label: t('runbooks.filter.verified') },
                { value: 'draft', label: t('runbooks.filter.draft') },
                { value: 'stale', label: t('runbooks.filter.stale') },
              ]}
            />
            <ToolbarSpacer />
            <ToolbarMeta>{filtered.length}</ToolbarMeta>
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
          isEmpty={() => filtered.length === 0}
          emptyTitle={t('runbooks.empty.title')}
          emptyDetail={t('runbooks.empty.detail')}
        >
          {() => (
            <div className={styles.layout}>
              <ul className={styles.list}>
                {filtered.map((rb) => (
                  <li key={rb.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(rb.id)}
                      className={
                        rb.id === active?.id ? `${styles.item} ${styles.itemActive}` : styles.item
                      }
                    >
                      <div className={styles.itemHead}>
                        <span className={styles.itemTitle}>{rb.title}</span>
                        <StatusBadge tone={STATUS_TONE[rb.status]} dot>
                          {t(`runbooks.status.${rb.status}` as `runbooks.status.draft`)}
                        </StatusBadge>
                      </div>
                      <span className={styles.itemSummary}>{rb.summary}</span>
                      <div className={styles.itemMeta}>
                        <span>{t('runbooks.steps', { count: rb.steps.length })}</span>
                        {rb.last_run_at && (
                          <span>· {t('runbooks.lastRun', { time: timeAgo(rb.last_run_at) })}</span>
                        )}
                      </div>
                      <div className={styles.tagWrap}>
                        {rb.tags.map((tag) => (
                          <span key={tag} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {active ? <RunbookView runbook={active} onDeleted={() => setActiveId(undefined)} /> : null}
            </div>
          )}
        </QueryBoundary>
      </Card>
    </Page>
  );
}

function RunbookView({ runbook, onDeleted }: { runbook: Runbook; onDeleted: () => void }) {
  const t = useT();
  const del = useDeleteRunbook();
  const confirmDelete = useConfirmDelete();
  const toast = useMutationToast();
  // Seeded runbooks come from the backend's static fallback (IDs prefixed
  // with rb-node-/rb-service-) and aren't deletable until the operator
  // adds their own; the ID isn't a real DB row.
  const isSeed = runbook.id.startsWith('rb-node-') || runbook.id.startsWith('rb-service-');
  return (
    <article className={styles.viewer}>
      <header className={styles.viewerHead}>
        <div>
          <div className={styles.viewerTitle}>{runbook.title}</div>
          <div className={styles.viewerSubtitle}>{runbook.summary}</div>
        </div>
        <div className={styles.viewerMeta}>
          <StatusBadge tone={STATUS_TONE[runbook.status]} dot>
            {t(`runbooks.status.${runbook.status}` as `runbooks.status.draft`)}
          </StatusBadge>
          {runbook.scope && <span className="code">{runbook.scope}</span>}
          {!isSeed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ok = await confirmDelete({
                  title: t('common.delete'),
                  description: t('runbooks.confirm.delete'),
                });
                if (!ok) return;
                try {
                  await del.mutateAsync(runbook.id);
                  toast.success(t('common.deleted'), runbook.title);
                  onDeleted();
                } catch (err) {
                  toast.error(err);
                }
              }}
              disabled={del.isPending}
              aria-label={t('common.delete')}
            >
              <Icon name="x" size={14} />
            </Button>
          )}
        </div>
      </header>

      <ol className={styles.steps}>
        {runbook.steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.stepIndex}>{i + 1}</span>
            <div>
              <div className={styles.stepTitle}>{step.title}</div>
              <p className={styles.stepBody}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
