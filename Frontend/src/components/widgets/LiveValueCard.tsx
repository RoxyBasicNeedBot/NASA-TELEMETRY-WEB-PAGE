import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import type { FieldSample } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Live Value Card Widget — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_SAMPLES: FieldSample[] = [];

interface Props {
  fieldRef: string;     // "sensorId.fieldKey"
  title?: string;
  compact?: boolean;
}

export function LiveValueCard({ fieldRef, title, compact = false }: Props) {
  const value = useTelemetryStore(s => s.latestValues[fieldRef] ?? null);
  const timestamp = useTelemetryStore(s => s.latestTimestamps[fieldRef] ?? null);
  const samples = useTelemetryStore(s => s.sampleBuffers[fieldRef] ?? EMPTY_SAMPLES);

  const fieldDef = sensorRegistry.getField(fieldRef);
  const displayTitle = title ?? fieldDef?.label ?? fieldRef;
  const unit = fieldDef?.unit ?? '';
  const precision = fieldDef?.precision ?? 1;

  // Trend: compare last two samples
  let trend = 'neutral';
  if (samples.length >= 2) {
    const last = samples[samples.length - 1].value;
    const prev = samples[samples.length - 2].value;
    const diff = last - prev;
    if (Math.abs(diff) >= 0.01) trend = diff > 0 ? 'up' : 'down';
  }

  // Alert state
  const thresholds = fieldDef?.alertThresholds;
  let alertState = 'none';
  if (value !== null && thresholds) {
    if (
      (thresholds.critical_high !== undefined && value >= thresholds.critical_high)
      || (thresholds.critical_low !== undefined && value <= thresholds.critical_low)
    ) {
      alertState = 'critical';
    } else if (
      (thresholds.high !== undefined && value >= thresholds.high)
      || (thresholds.low !== undefined && value <= thresholds.low)
    ) {
      alertState = 'warning';
    }
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-sky-400' : 'text-slate-600';

  const valueColor = alertState === 'critical' ? 'text-rose-400'
    : alertState === 'warning' ? 'text-amber-400'
    : 'text-slate-100';

  const formattedValue = value !== null
    ? value.toFixed(precision)
    : null;

  return (
    <div className="h-full flex flex-col p-3.5 bg-transparent relative overflow-hidden">
      <div className="flex items-start justify-between mb-auto z-10">
        <div>
          <p className="text-slate-400 text-[10px] font-mono font-semibold uppercase tracking-wider">{displayTitle}</p>
          {alertState !== 'none' && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle size={11} className={alertState === 'critical' ? 'text-rose-400' : 'text-amber-400'} />
              <span className={`text-[10px] font-mono font-semibold uppercase ${alertState === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                {alertState === 'critical' ? 'CRITICAL' : 'WARNING'}
              </span>
            </div>
          )}
        </div>
        <TrendIcon size={14} className={`${trendColor} shrink-0 mt-0.5`} />
      </div>

      <div className="flex items-baseline gap-1.5 mt-2 z-10 font-mono">
        {formattedValue !== null ? (
          <>
            <span className={`font-bold tabular-nums tracking-tight leading-none ${compact ? 'text-2xl' : 'text-3xl'} ${valueColor}`}>
              {formattedValue}
            </span>
            <span className="text-slate-400 text-xs font-medium">{unit}</span>
          </>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-600 text-2xl font-bold">—</span>
            <span className="text-slate-500 text-[10px] font-mono">AWAITING PACKET</span>
          </div>
        )}
      </div>

      {timestamp && (
        <div className="flex items-center gap-1.5 mt-2 text-slate-500 text-[10px] font-mono z-10">
          <Clock size={10} className="text-slate-500" />
          <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
        </div>
      )}

      {/* Range indicator bar */}
      {fieldDef?.min !== undefined && fieldDef.max !== undefined && value !== null && (
        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden z-10 border border-white/[0.04]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              alertState === 'critical' ? 'bg-rose-500'
              : alertState === 'warning' ? 'bg-amber-500'
              : 'bg-sky-400'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, ((value - fieldDef.min) / (fieldDef.max - fieldDef.min)) * 100))}%`
            }}
          />
        </div>
      )}
    </div>
  );
}
