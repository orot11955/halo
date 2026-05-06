import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/ui/Grid';
import { Segmented } from '@/components/ui/Segmented';
import { Toolbar, ToolbarMeta, ToolbarSpacer } from '@/components/ui/Toolbar';
import { TimeSeries, type SeriesDef } from '@/components/charts/TimeSeries';
import { QueryBoundary } from '@/components/ui/QueryBoundary';
import { Icon } from '@/components/ui/Icon';
import { useMetricsHistory } from '@/hooks/useMetrics';
import { METRICS_RANGE_OPTIONS, type MetricsRange, type MetricPoint } from '@/types/metrics';
import { formatBytesPerSec } from '@/utils/format';
import { useT, useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n';

const RANGE_KEY: Record<MetricsRange, TranslationKey> = {
  '5m': 'metrics.range.5m',
  '1h': 'metrics.range.1h',
  '6h': 'metrics.range.6h',
  '24h': 'metrics.range.24h',
  '7d': 'metrics.range.7d',
};

const COLORS = {
  cpu: '#2fd4b5',
  load: '#8ab4ff',
  memory: '#4ade80',
  disk: '#f5b544',
  rx: '#5fbedc',
  tx: '#f97373',
};

function metricsRangeFromParam(value: string | null): MetricsRange {
  return METRICS_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as MetricsRange)
    : '1h';
}

export function NodeMetrics({ name }: { name: string }) {
  const t = useT();
  const { locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [range, setRangeState] = useState<MetricsRange>(() =>
    metricsRangeFromParam(searchParams.get('range')),
  );
  const query = useMetricsHistory(name, range);

  useEffect(() => {
    setRangeState(metricsRangeFromParam(searchParams.get('range')));
  }, [searchParams]);

  const setRange = (next: MetricsRange) => {
    setRangeState(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === '1h') params.delete('range');
        else params.set('range', next);
        return params;
      },
      { replace: true },
    );
  };

  const rangeOptions = METRICS_RANGE_OPTIONS.map((r) => ({
    value: r.value,
    label: t(RANGE_KEY[r.value]),
  }));

  const networkData = useMemo(() => {
    const points = query.data?.points ?? [];
    if (points.length < 2) return [];
    const result: { time: string; rx: number; tx: number }[] = [];
    for (let i = 1; i < points.length; i++) {
      const cur = points[i];
      const prev = points[i - 1];
      const dt = (new Date(cur.time).getTime() - new Date(prev.time).getTime()) / 1000;
      result.push({
        time: cur.time,
        rx: dt > 0 ? Math.max(0, (cur.network_rx_bytes_total - prev.network_rx_bytes_total) / dt) : 0,
        tx: dt > 0 ? Math.max(0, (cur.network_tx_bytes_total - prev.network_tx_bytes_total) / dt) : 0,
      });
    }
    return result;
  }, [query.data]);

  return (
    <Card
      title={t('metrics.title')}
      subtitle={
        query.data
          ? t('metrics.subtitle.step', { step: query.data.step })
          : t('metrics.subtitle.empty')
      }
      flush
    >
      <div
        style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Toolbar>
          <Segmented value={range} onChange={setRange} options={rangeOptions} />
          <ToolbarSpacer />
          <ToolbarMeta>
            {query.isFetching
              ? t('metrics.fetching')
              : t('metrics.refreshedAt', {
                  time: new Date().toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US'),
                })}
          </ToolbarMeta>
        </Toolbar>
      </div>

      <div style={{ padding: 'var(--space-5)' }}>
        <QueryBoundary
          isLoading={query.isLoading}
          error={query.error}
          data={query.data}
          isEmpty={(d) => d.points.length === 0}
          emptyTitle={t('metrics.empty.title')}
          emptyDetail={t('metrics.empty.detail')}
          loadingLabel={t('common.loading')}
        >
          {(data) => (
            <Grid cols={2}>
              <ChartCard title={t('metrics.chart.cpu')} icon="cpu">
                <TimeSeries
                  data={data.points as unknown as Record<string, number | string>[]}
                  series={[
                    { key: 'cpu_used_percent', label: 'CPU', color: COLORS.cpu, unit: '%' },
                  ]}
                  yDomain={[0, 100]}
                  warningThreshold={80}
                />
              </ChartCard>
              <ChartCard title={t('metrics.chart.load')} icon="activity">
                <TimeSeries
                  data={data.points as unknown as Record<string, number | string>[]}
                  series={[
                    { key: 'cpu_load_1', label: 'load1', color: COLORS.load },
                    { key: 'cpu_load_5', label: 'load5', color: COLORS.cpu },
                    { key: 'cpu_load_15', label: 'load15', color: COLORS.memory },
                  ]}
                />
              </ChartCard>
              <ChartCard title={t('metrics.chart.memory')} icon="memory">
                <TimeSeries
                  data={data.points as unknown as Record<string, number | string>[]}
                  series={[
                    { key: 'memory_used_percent', label: 'Memory', color: COLORS.memory, unit: '%' },
                  ]}
                  yDomain={[0, 100]}
                  warningThreshold={85}
                />
              </ChartCard>
              <ChartCard title={t('metrics.chart.disk')} icon="disk">
                <TimeSeries
                  data={data.points as unknown as Record<string, number | string>[]}
                  series={[
                    { key: 'disk_root_used_percent', label: 'Disk', color: COLORS.disk, unit: '%' },
                  ]}
                  yDomain={[0, 100]}
                  warningThreshold={90}
                />
              </ChartCard>
              <ChartCard title={t('metrics.chart.network')} icon="network">
                <TimeSeries
                  data={networkData as unknown as Record<string, number | string>[]}
                  series={[
                    { key: 'rx', label: 'RX', color: COLORS.rx },
                    { key: 'tx', label: 'TX', color: COLORS.tx },
                  ] as SeriesDef[]}
                  unitFormatter={(v) => formatBytesPerSec(v)}
                />
              </ChartCard>
              <PointsSummary points={data.points} />
            </Grid>
          )}
        </QueryBoundary>
      </div>
    </Card>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: 'cpu' | 'memory' | 'disk' | 'network' | 'activity';
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--color-surface-2)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: 'var(--color-text-subtle)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {icon && <Icon name={icon} size={12} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function PointsSummary({ points }: { points: MetricPoint[] }) {
  const t = useT();
  const last = points[points.length - 1];
  if (!last) return null;
  return (
    <ChartCard title={t('metrics.chart.latest')} icon="activity">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <Row label={t('metrics.row.cpu')} value={`${last.cpu_used_percent.toFixed(1)}%`} />
        <Row
          label={t('metrics.row.load')}
          value={`${last.cpu_load_1} / ${last.cpu_load_5} / ${last.cpu_load_15}`}
        />
        <Row label={t('metrics.row.memory')} value={`${last.memory_used_percent.toFixed(1)}%`} />
        <Row label={t('metrics.row.disk')} value={`${last.disk_root_used_percent.toFixed(1)}%`} />
        <Row
          label={t('metrics.row.netRx')}
          value={formatBytesPerSec(last.network_rx_bytes_total).replace('/s', '')}
        />
        <Row
          label={t('metrics.row.netTx')}
          value={formatBytesPerSec(last.network_tx_bytes_total).replace('/s', '')}
        />
      </div>
    </ChartCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
