import { useMemo, useState, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';
import type { TimeRange, FieldSample } from '../../types/telemetry';
import { format, subMinutes, subHours } from 'date-fns';
import { Pause, Play, ZoomIn } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Generic Time-Series Chart Widget — Black Hole Nebula Charts
// ─────────────────────────────────────────────────────────────────────────────

interface SeriesConfig {
  fieldRef: string;   // "sensorId.fieldKey"
  color?: string;
  label?: string;
}

interface Props {
  series: SeriesConfig[];
  title?: string;
  chartType?: 'timeseries' | 'area' | 'bar';
  timeRange?: TimeRange;
  autoScale?: boolean;
  yMin?: number;
  yMax?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  smoothing?: boolean;
  height?: number;
}

const DEFAULT_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#818cf8', '#f43f5e'];
const MAX_VISIBLE_POINTS = 300;

function getWindowStart(range: TimeRange): number {
  const now = Date.now();
  switch (range) {
    case '1m':  return subMinutes(now, 1).getTime();
    case '5m':  return subMinutes(now, 5).getTime();
    case '15m': return subMinutes(now, 15).getTime();
    case '1h':  return subHours(now, 1).getTime();
    case '6h':  return subHours(now, 6).getTime();
    default:    return subMinutes(now, 5).getTime();
  }
}

function decimateSamples(samples: FieldSample[], maxPoints: number): FieldSample[] {
  if (samples.length <= maxPoints) return samples;
  const step = Math.ceil(samples.length / maxPoints);
  return samples.filter((_, i) => i % step === 0 || i === samples.length - 1);
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-2 text-xs rounded-md shadow-xl font-mono bg-[#0b0e17] border border-white/10">
      <p className="text-slate-400 mb-1 text-[10px] font-mono">{label ? format(new Date(label), 'HH:mm:ss') : ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400 text-[11px] font-medium">{p.name}:</span>
          <span className="text-slate-100 font-mono font-semibold text-[11px] tabular-nums">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function TimeSeriesChart({
  series,
  chartType = 'timeseries',
  timeRange = '5m',
  autoScale = true,
  yMin,
  yMax,
  showGrid = true,
  showLegend = false,
  smoothing = false,
}: Props) {
  const [paused, setPaused] = useState(false);
  const buffers = useTelemetryStore(s => s.sampleBuffers);

  // Build unified chart data from all series
  const chartData = useMemo(() => {
    const windowStart = getWindowStart(timeRange);

    // Collect and filter samples per series
    const filtered = series.map((s) => {
      const raw = buffers[s.fieldRef] ?? [];
      return {
        ...s,
        samples: raw.filter(p => p.timestamp >= windowStart),
      };
    });

    if (filtered.every(s => s.samples.length === 0)) return [];

    // Build time-keyed data points
    const timeMap = new Map<number, Record<string, number>>();

    for (const s of filtered) {
      const decimated = decimateSamples(s.samples, MAX_VISIBLE_POINTS);
      for (const sample of decimated) {
        const existing = timeMap.get(sample.timestamp) ?? {};
        existing[s.fieldRef] = sample.value;
        timeMap.set(sample.timestamp, existing);
      }
    }

    return Array.from(timeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, values]) => ({ ts, ...values }));
  }, [buffers, series, timeRange, paused]);  // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = chartData.length === 0;

  // Compute Y domain
  const [computedMin, computedMax] = useMemo(() => {
    if (!autoScale || (yMin !== undefined && yMax !== undefined)) {
      return [yMin, yMax];
    }
    const allValues = chartData.flatMap(d =>
      series.map(s => d[s.fieldRef as keyof typeof d] as number | undefined).filter((v): v is number => v !== undefined)
    );
    if (!allValues.length) return [undefined, undefined];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = Math.max((max - min) * 0.1, 1);
    return [min - padding, max + padding];
  }, [chartData, series, autoScale, yMin, yMax]);

  const tickFormatter = (v: number) => format(new Date(v), 'HH:mm:ss');

  const sharedProps = {
    data: chartData,
    margin: { top: 6, right: 10, bottom: 4, left: -10 },
  };

  const xAxisProps = {
    dataKey: 'ts' as const,
    type: 'number' as const,
    scale: 'time' as const,
    domain: ['dataMin', 'dataMax'] as ['dataMin', 'dataMax'],
    tickFormatter,
    tick: { fill: 'rgba(255,255,255,0.3)', fontSize: 10 },
    tickCount: 5,
    stroke: 'rgba(255,255,255,0.06)',
  };

  const yAxisProps = {
    domain: [computedMin ?? 'auto', computedMax ?? 'auto'] as ['auto' | number, 'auto' | number],
    tick: { fill: 'rgba(255,255,255,0.3)', fontSize: 10 },
    width: 45,
    stroke: 'rgba(255,255,255,0.06)',
  };

  const renderChart = useCallback(() => {
    if (chartType === 'area') {
      return (
        <AreaChart {...sharedProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />}
          {series.map((s, i) => {
            const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const label = s.label ?? sensorRegistry.getField(s.fieldRef)?.label ?? s.fieldRef;
            return (
              <Area
                key={s.fieldRef}
                type={smoothing ? 'monotone' : 'linear'}
                dataKey={s.fieldRef}
                name={label}
                stroke={color}
                fill={`${color}20`}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            );
          })}
        </AreaChart>
      );
    }

    if (chartType === 'bar') {
      return (
        <BarChart {...sharedProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />}
          {series.map((s, i) => {
            const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const label = s.label ?? sensorRegistry.getField(s.fieldRef)?.label ?? s.fieldRef;
            return (
              <Bar key={s.fieldRef} dataKey={s.fieldRef} name={label} fill={color} isAnimationActive={false} />
            );
          })}
        </BarChart>
      );
    }

    // default: timeseries line
    return (
      <LineChart {...sharedProps}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />}
        {series.map((s, i) => {
          const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const label = s.label ?? sensorRegistry.getField(s.fieldRef)?.label ?? s.fieldRef;
          return (
            <Line
              key={s.fieldRef}
              type={smoothing ? 'monotone' : 'linear'}
              dataKey={s.fieldRef}
              name={label}
              stroke={color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          );
        })}
      </LineChart>
    );
  }, [chartType, chartData, series, showGrid, showLegend, smoothing, computedMin, computedMax]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col bg-transparent rounded-2xl overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-3.5 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {series.map((s, i) => (
            <div key={s.fieldRef} className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111624] border border-white/[0.08]">
              <div className="w-2 h-1 rounded-sm" style={{ background: s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
              <span className="text-slate-300 text-[11px] font-medium font-mono">{s.label ?? sensorRegistry.getField(s.fieldRef)?.label ?? s.fieldRef}</span>
              <span className="text-slate-500 text-[10px] font-mono">{sensorRegistry.getField(s.fieldRef)?.unit}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          className="p-1 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded transition-colors"
          title={paused ? 'Resume live update' : 'Pause update'}
        >
          {paused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} />}
        </button>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-1.5 font-mono">
            <ZoomIn size={20} className="text-slate-600" />
            <p className="text-xs font-medium text-slate-400">NO TELEMETRY IN WINDOW</p>
            <p className="text-[10px] text-slate-600">Awaiting stream packets…</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
