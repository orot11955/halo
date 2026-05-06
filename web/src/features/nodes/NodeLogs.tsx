import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Toolbar, SearchInput, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { EmptyState } from '@/components/ui/States';
import { useLogSources, useLogTail } from '@/hooks/useLogs';
import { isFeatureDisabledError } from '@/services/apiClient';
import { formatDateTime, timeAgo } from '@/utils/date';
import { isTimeRange, isWithinTimeRange, type TimeRange } from '@/utils/timeRange';
import { useT } from '@/i18n';
import type { LogLevel } from '@/types/log';
import styles from './NodeLogs.module.css';

const LEVEL_TONE: Record<LogLevel, 'neutral' | 'info' | 'warning' | 'danger'> = {
  debug: 'neutral',
  info: 'info',
  notice: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
};

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  notice: 2,
  warning: 3,
  error: 4,
  critical: 5,
};

type LogLevelFilter = 'all' | 'warningPlus' | 'errorPlus';

function levelFilterFromParam(value: string | null): LogLevelFilter {
  if (value === 'warningPlus' || value === 'errorPlus') return value;
  return 'all';
}

export function NodeLogs({ name }: { name: string }) {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const sourcesQuery = useLogSources(name);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [filter, setFilterState] = useState<LogLevelFilter>(() =>
    levelFilterFromParam(searchParams.get('level')),
  );
  const [range, setRangeState] = useState<TimeRange>(() => {
    const value = searchParams.get('range');
    return isTimeRange(value) ? value : 'all';
  });
  const [search, setSearchState] = useState(() => searchParams.get('q') ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFilterState(levelFilterFromParam(searchParams.get('level')));
    const nextRange = searchParams.get('range');
    setRangeState(isTimeRange(nextRange) ? nextRange : 'all');
    setSearchState(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const sources = sourcesQuery.data ?? [];
    if (sources.length === 0) return;
    const requestedSource = searchParams.get('source');
    if (requestedSource && sources.some((s) => s.id === requestedSource)) {
      setActiveId(requestedSource);
      return;
    }
    if (!activeId || !sources.some((s) => s.id === activeId)) {
      setActiveId(sources[0].id);
    }
  }, [sourcesQuery.data, activeId, searchParams]);

  const tailQuery = useLogTail(name, activeId);

  const filteredLines = useMemo(() => {
    const lines = tailQuery.data ?? [];
    const minRank = filter === 'errorPlus' ? LEVEL_RANK.error : filter === 'warningPlus' ? LEVEL_RANK.warning : 0;
    const term = search.trim().toLowerCase();
    const now = Date.now();
    return lines.filter(
      (l) =>
        LEVEL_RANK[l.level] >= minRank &&
        isWithinTimeRange(l.ts, range, now) &&
        (term === '' || l.message.toLowerCase().includes(term)),
    );
  }, [tailQuery.data, filter, range, search]);

  const sources = sourcesQuery.data ?? [];
  const activeSource = sources.find((s) => s.id === activeId);
  const liveLogsDisabled = isFeatureDisabledError(tailQuery.error);

  function copyLog() {
    const text = filteredLines.map((l) => `${l.ts} ${l.level} ${l.message}`).join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function updateParam(key: string, value: string, emptyValue = 'all') {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (!value || value === emptyValue) params.delete(key);
        else params.set(key, value);
        return params;
      },
      { replace: true },
    );
  }

  function setFilter(value: LogLevelFilter) {
    setFilterState(value);
    updateParam('level', value);
  }

  function setRange(value: TimeRange) {
    setRangeState(value);
    updateParam('range', value);
  }

  function setSearch(value: string) {
    setSearchState(value);
    updateParam('q', value.trim(), '');
  }

  function setSource(value: string) {
    setActiveId(value);
    updateParam('source', value, '');
  }

  const rangeOptions = [
    { value: 'all', label: t('timeRange.all') },
    { value: '15m', label: t('timeRange.15m') },
    { value: '1h', label: t('timeRange.1h') },
    { value: '24h', label: t('timeRange.24h') },
    { value: '7d', label: t('timeRange.7d') },
  ];

  return (
    <Card title={t('logs.title')} subtitle={t('logs.subtitle')} flush>
      <div className={styles.layout}>
        <aside className={styles.sources}>
          <div className={styles.sourcesHeader}>{t('logs.sources')}</div>
          {sources.length === 0 ? (
            <div className={styles.sourcesEmpty}>{t('logs.empty.sources')}</div>
          ) : (
            <ul className={styles.sourceList}>
              {sources.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === activeId ? `${styles.source} ${styles.active}` : styles.source}
                    onClick={() => setSource(s.id)}
                  >
                    <span className={styles.sourceTitle}>{s.name}</span>
                    <span className={styles.sourceKind}>{t(`logs.kind.${s.kind}`)}</span>
                    <span className={styles.sourceTarget}>{s.target}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={styles.viewer}>
          <div className={styles.viewerToolbar}>
            <Toolbar>
              <SearchInput value={search} onChange={setSearch} placeholder={t('logs.search')} />
              <Segmented
                value={filter}
                onChange={(v) => setFilter(v as LogLevelFilter)}
                options={[
                  { value: 'all', label: t('logs.filter.all') },
                  { value: 'warningPlus', label: t('logs.filter.warningPlus') },
                  { value: 'errorPlus', label: t('logs.filter.errorPlus') },
                ]}
              />
              <Segmented value={range} onChange={(v) => setRange(v as TimeRange)} options={rangeOptions} />
              <ToolbarSpacer />
              <ToolbarMeta>{filteredLines.length}</ToolbarMeta>
              <Button size="sm" onClick={copyLog} disabled={filteredLines.length === 0}>
                <Icon name={copied ? 'check' : 'inbox'} size={12} />
                {copied ? t('logs.copyDone') : t('logs.copy')}
              </Button>
              <Button size="sm" onClick={() => tailQuery.refetch()}>
                <Icon name="refresh" size={12} />
                {t('common.refresh')}
              </Button>
            </Toolbar>
            {activeSource && (
              <div className={styles.viewerHint}>
                <span className="code">{activeSource.target}</span>
                <span> · {t('logs.refreshHint')}</span>
              </div>
            )}
          </div>

          {!activeId ? (
            <EmptyState icon="inbox" title={t('logs.empty.sources')} />
          ) : liveLogsDisabled ? (
            <EmptyState
              icon="lock"
              title={t('logs.disabled.title')}
              detail={t('logs.disabled.detail')}
            />
          ) : (
            <QueryBoundary
              isLoading={tailQuery.isLoading}
              error={tailQuery.error}
              data={tailQuery.data}
              isEmpty={() => filteredLines.length === 0}
              emptyTitle={t('logs.empty.lines')}
            >
              {() => (
                <pre className={styles.logBody}>
                  {filteredLines.map((line, i) => (
                    <div key={`${line.ts}-${i}`} className={styles.logLine}>
                      <time
                        title={formatDateTime(line.ts)}
                        className={styles.logTime}
                      >
                        {timeAgo(line.ts)}
                      </time>
                      <StatusBadge tone={LEVEL_TONE[line.level]} variant="solid">
                        {line.level}
                      </StatusBadge>
                      <span className={styles.logMessage}>{line.message}</span>
                    </div>
                  ))}
                </pre>
              )}
            </QueryBoundary>
          )}
        </section>
      </div>
    </Card>
  );
}
