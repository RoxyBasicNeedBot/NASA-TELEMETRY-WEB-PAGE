import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Gauge Widget — Black Hole Accretion Disk Radial Gauge
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  fieldRef: string;
  title?: string;
}

export function GaugeWidget({ fieldRef, title }: Props) {
  const value = useTelemetryStore(s => s.latestValues[fieldRef] ?? null);
  const fieldDef = sensorRegistry.getField(fieldRef);
  const label = title ?? fieldDef?.label ?? fieldRef;
  const unit = fieldDef?.unit ?? '';
  const min = fieldDef?.min ?? 0;
  const max = fieldDef?.max ?? 100;
  const precision = fieldDef?.precision ?? 1;

  const pct = value !== null ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  const fillStyle = pct > 95 ? '#ef4444' : pct > 85 ? '#f59e0b' : '#38bdf8';

  const data = [{ name: label, value: pct, fill: fillStyle }];

  return (
    <div className="h-full flex flex-col items-center justify-center p-3 bg-transparent">
      <div className="w-full flex-1 min-h-0 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#1e2433' }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={4}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center -mt-4 pb-1 z-10 font-mono">
        {value !== null ? (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold tracking-tight text-slate-100 tabular-nums">
              {value.toFixed(precision)}
            </span>
            <span className="text-slate-400 text-xs font-medium">{unit}</span>
          </div>
        ) : (
          <span className="text-slate-600 text-xl font-bold">—</span>
        )}
        <p className="text-slate-400 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
