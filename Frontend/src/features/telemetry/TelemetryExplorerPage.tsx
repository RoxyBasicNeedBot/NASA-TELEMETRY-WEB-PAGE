import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import { Radio, CheckCircle2, Clock } from 'lucide-react';
import { DiagnosticsPanel } from './DiagnosticsPanel';

export function TelemetryExplorerPage() {
  const latestValues = useTelemetryStore(s => s.latestValues);
  const latestTimestamps = useTelemetryStore(s => s.latestTimestamps);
  const fields = sensorRegistry.getAllFields();
  const sensors = sensorRegistry.getAllSensors();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
            <Radio size={16} className="text-sky-400" /> Channel Telemetry Explorer
          </h1>
          <p className="text-white/40 text-xs font-mono mt-0.5">Real-time telemetry telemetry parameters, status flags, and bus link diagnostics</p>
        </div>
      </div>

      {/* Fields table */}
      <div className="bg-[#0d111c] border border-white/[0.08] rounded-xl overflow-hidden font-mono">
        <div className="grid grid-cols-[1.5fr_1fr_auto_auto_auto] gap-0 text-[10px] text-white/50 px-4 py-2 border-b border-white/[0.08] bg-[#090c14] uppercase tracking-wider">
          <span>Payload · Channel</span>
          <span>Sample Value</span>
          <span className="w-20">Unit</span>
          <span className="w-24">Link Status</span>
          <span className="w-28 text-right">Age</span>
        </div>

        {fields.length === 0 && (
          <div className="px-4 py-8 text-center text-white/40 text-xs">
            No sensor channels detected. Configure hardware in the Sensor Payload Bus.
          </div>
        )}

        {fields.map(({ sensorId, fieldDef }) => {
          const ref = `${sensorId}.${fieldDef.fieldKey}`;
          const value = latestValues[ref] ?? null;
          const ts = latestTimestamps[ref] ?? null;
          const sensor = sensors.find(s => s.sensorId === sensorId);
          const hasData = value !== null;

          return (
            <div
              key={ref}
              className="grid grid-cols-[1.5fr_1fr_auto_auto_auto] gap-0 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center text-xs"
            >
              <div>
                <p className="text-white font-medium">{fieldDef.label}</p>
                <p className="text-white/40 text-[11px]">{sensor?.displayName ?? sensorId}</p>
              </div>

              <div>
                {hasData ? (
                  <span className="text-sky-300 font-semibold font-mono">
                    {value!.toFixed(fieldDef.precision ?? 2)}
                  </span>
                ) : (
                  <span className="text-white/30 text-[11px] italic">Awaiting telemetry...</span>
                )}
              </div>

              <span className="text-white/40 text-xs font-mono w-20">{fieldDef.unit}</span>

              <div className="w-24">
                {hasData ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] text-emerald-400 uppercase font-semibold">ACTIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                    <span className="text-[11px] text-amber-400/70 uppercase">STANDBY</span>
                  </div>
                )}
              </div>

              <div className="w-28 text-right">
                {ts ? (
                  <span className="text-white/40 text-[11px] font-mono">{formatDistanceToNow(new Date(ts), { addSuffix: true })}</span>
                ) : (
                  <span className="text-white/20 text-[11px] font-mono">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostics */}
      <DiagnosticsPanel />
    </div>
  );
}
