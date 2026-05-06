import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTime } from '@/utils/date';
import styles from './TimeSeries.module.css';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  /** For tooltip + axis suffix (e.g. '%', 'KB/s'). */
  unit?: string;
}

interface TimeSeriesProps {
  data: Record<string, number | string>[];
  xKey?: string;
  series: SeriesDef[];
  yDomain?: [number | 'auto', number | 'auto'];
  warningThreshold?: number;
  height?: number;
  unitFormatter?: (value: number) => string;
}

export function TimeSeries({
  data,
  xKey = 'time',
  series,
  yDomain,
  warningThreshold,
  height,
  unitFormatter,
}: TimeSeriesProps) {
  return (
    <div className={styles.wrap} style={height ? { height } : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`gradient-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }}
            stroke="var(--color-border)"
            tickFormatter={(v) => formatTime(v)}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-subtle)', fontSize: 11 }}
            stroke="var(--color-border)"
            domain={yDomain}
            width={40}
            tickFormatter={(v) =>
              unitFormatter ? unitFormatter(v) : series[0]?.unit ? `${v}${series[0].unit}` : `${v}`
            }
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-border-strong)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className={styles.tooltip}>
                  <div className={styles.tooltipTime}>{formatTime(label)}</div>
                  {payload.map((p) => {
                    const def = series.find((s) => s.key === p.dataKey);
                    if (!def) return null;
                    const value =
                      typeof p.value === 'number'
                        ? unitFormatter
                          ? unitFormatter(p.value)
                          : `${p.value.toFixed(1)}${def.unit ?? ''}`
                        : String(p.value);
                    return (
                      <div key={def.key} className={styles.tooltipRow}>
                        <span
                          className={styles.tooltipDot}
                          style={{ background: def.color }}
                        />
                        <span style={{ color: 'var(--color-text-muted)' }}>{def.label}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 500 }}>{value}</span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          {warningThreshold !== undefined && (
            <ReferenceLine
              y={warningThreshold}
              stroke="var(--color-warning)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
          )}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.6}
              fill={`url(#gradient-${s.key})`}
              isAnimationActive={false}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
