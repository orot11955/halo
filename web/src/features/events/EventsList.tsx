import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Segmented } from '@/components/ui/Segmented';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/table/DataTable';
import { SeverityBadge } from '@/components/status/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useEventList, useResolveEvent } from '@/hooks/useEvents';
import { useFilteredList } from '@/hooks/useFilteredList';
import { useStream } from '@/hooks/useStream';
import { formatDateTime, timeAgo } from '@/utils/date';
import { isTimeRange, isWithinTimeRange, type TimeRange } from '@/utils/timeRange';
import { useT } from '@/i18n';
import type { HaloEvent } from '@/types/event';

interface EventsListProps {
  /** When true, defaults filters to alerts mode and shows only warning+ unresolved events. */
  alertsOnly?: boolean;
}

export function EventsList({ alertsOnly = false }: EventsListProps) {
  const t = useT();
  const query = useEventList();
  const resolveMutation = useResolveEvent();
  const live = useStream(20);

  const merged = useMemo(() => {
    if (!query.data) return live;
    const seen = new Set<string>();
    const all: HaloEvent[] = [];
    for (const e of [...live, ...query.data]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      all.push(e);
    }
    return all.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    );
  }, [query.data, live]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    merged.forEach((e) => set.add(e.source));
    const sources = Array.from(set).sort();
    return [
      { value: 'all', label: t('events.filter.source.all') },
      ...sources.map((s) => ({ value: s, label: s })),
    ];
  }, [merged, t]);

  const filtered = useFilteredList<HaloEvent>(merged, {
    searchFields: ['source', 'subject', 'message', 'kind'],
    initialFilters: {
      severity: alertsOnly ? 'warning' : 'all',
      resolvedFilter: alertsOnly ? 'unresolved' : 'all',
      source: 'all',
      range: 'all',
    },
    manualFilterKeys: ['severity', 'resolvedFilter', 'source', 'range'],
    urlSync: {
      filterParams: {
        severity: 'severity',
        resolvedFilter: 'state',
        source: 'source',
        range: 'range',
      },
    },
  });

  const visible = useMemo(() => {
    const r = filtered.filters.resolvedFilter ?? 'all';
    const sev = filtered.filters.severity ?? 'all';
    const src = filtered.filters.source ?? 'all';
    const candidateRange = filtered.filters.range;
    const range: TimeRange = isTimeRange(candidateRange) ? candidateRange : 'all';
    const now = Date.now();
    return filtered.data.filter((e) => {
      if (r === 'resolved' && !e.resolved) return false;
      if (r === 'unresolved' && e.resolved) return false;
      if (sev === 'warning') {
        if (e.severity === 'info') return false;
      } else if (sev !== 'all' && e.severity !== sev) {
        return false;
      }
      if (src !== 'all' && e.source !== src) return false;
      if (!isWithinTimeRange(e.occurred_at, range, now)) return false;
      return true;
    });
  }, [filtered.data, filtered.filters]);

  const severityFilter = [
    { value: 'all', label: t('events.filter.severity.all') },
    { value: 'critical', label: t('severity.critical') },
    { value: 'warning', label: t('severity.warning') },
    { value: 'info', label: t('severity.info') },
  ];

  const resolvedFilter = [
    { value: 'all', label: t('events.filter.resolved.all') },
    { value: 'unresolved', label: t('events.filter.resolved.unresolved') },
    { value: 'resolved', label: t('events.filter.resolved.resolved') },
  ];

  const rangeFilter = [
    { value: 'all', label: t('timeRange.all') },
    { value: '15m', label: t('timeRange.15m') },
    { value: '1h', label: t('timeRange.1h') },
    { value: '24h', label: t('timeRange.24h') },
    { value: '7d', label: t('timeRange.7d') },
  ];

  const columns: Column<HaloEvent>[] = [
    {
      key: 'severity',
      header: t('events.col.severity'),
      render: (e) => <SeverityBadge severity={e.severity} />,
    },
    {
      key: 'kind',
      header: t('events.col.kind'),
      render: (e) => <span className="code">{e.kind}</span>,
    },
    {
      key: 'subject',
      header: t('events.col.subject'),
      render: (e) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{e.subject}</span>
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
            {e.source}
          </span>
        </div>
      ),
    },
    {
      key: 'message',
      header: t('events.col.message'),
      render: (e) => <span style={{ color: 'var(--color-text-muted)' }}>{e.message}</span>,
    },
    {
      key: 'resolved',
      header: t('events.col.state'),
      render: (e) =>
        e.resolved ? (
          <StatusBadge tone="success">{t('events.state.resolved')}</StatusBadge>
        ) : (
          <StatusBadge tone="danger">{t('events.state.open')}</StatusBadge>
        ),
    },
    {
      key: 'occurred_at',
      header: t('events.col.time'),
      align: 'right',
      render: (e) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>{timeAgo(e.occurred_at)}</span>
          <span style={{ color: 'var(--color-text-subtle)', fontSize: 'var(--text-xs)' }}>
            {formatDateTime(e.occurred_at)}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('events.col.actions'),
      align: 'right',
      render: (e) =>
        e.resolved ? (
          <span style={{ color: 'var(--color-text-subtle)' }}>{t('common.dash')}</span>
        ) : (
          <Button
            size="sm"
            onClick={() => resolveMutation.mutate(e.id)}
            disabled={resolveMutation.isPending && resolveMutation.variables === e.id}
          >
            <Icon name="check" size={12} />
            {resolveMutation.isPending && resolveMutation.variables === e.id
              ? t('events.action.resolving')
              : t('events.action.resolve')}
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
            placeholder={t('events.search')}
          />
          <Segmented
            value={filtered.filters.severity ?? 'all'}
            onChange={(v) => filtered.setFilter('severity', v)}
            options={severityFilter}
          />
          <Segmented
            value={filtered.filters.resolvedFilter ?? 'all'}
            onChange={(v) => filtered.setFilter('resolvedFilter', v)}
            options={resolvedFilter}
          />
          <Segmented
            value={filtered.filters.range ?? 'all'}
            onChange={(v) => filtered.setFilter('range', v)}
            options={rangeFilter}
          />
          {sourceOptions.length > 2 && (
            <Segmented
              value={filtered.filters.source ?? 'all'}
              onChange={(v) => filtered.setFilter('source', v)}
              options={sourceOptions}
            />
          )}
          <ToolbarSpacer />
          <ToolbarMeta>{t('events.summary', { count: visible.length })}</ToolbarMeta>
          <Button size="sm" onClick={() => query.refetch()}>
            <Icon name="refresh" size={12} />
            {t('common.refresh')}
          </Button>
        </Toolbar>
      </div>
      <QueryBoundary
        isLoading={query.isLoading}
        error={query.error}
        data={merged}
        isEmpty={(d) => d.length === 0}
        emptyTitle={t('events.empty.title')}
      >
        {() => (
          <DataTable
            rows={visible}
            columns={columns}
            rowKey={(e) => e.id}
            emptyMessage={t('events.empty.detail')}
          />
        )}
      </QueryBoundary>
    </Card>
  );
}
