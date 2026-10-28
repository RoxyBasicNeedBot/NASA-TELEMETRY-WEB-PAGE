import { useTelemetryStore } from '../../stores/telemetryStore';
import { Terminal, AlertCircle, Package } from 'lucide-react';
import { format } from 'date-fns';

export function DiagnosticsPanel() {
  const diag = useTelemetryStore(s => s.diagnostics);

  return (
    <div className="bg-[#0d111c] border border-white/[0.08] rounded-xl overflow-hidden font-mono">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.08] bg-[#090c14]">
        <Terminal size={14} className="text-sky-400" />
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Avionics Diagnostics & Packet Bus</h3>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-white/50">
          <span className="flex items-center gap-1"><Package size={11} className="text-sky-400" />{diag.received.toLocaleString()} recv</span>
          {diag.invalid > 0 && <span className="flex items-center gap-1 text-red-400"><AlertCircle size={11} />{diag.invalid} invalid</span>}
          {diag.missedCount > 0 && <span className="text-amber-400">{diag.missedCount} dropped</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 text-xs">
        {/* Last raw packet */}
        <div className="p-3 border-b md:border-b-0 md:border-r border-white/[0.06]">
          <p className="text-[10px] text-sky-400 mb-1.5 uppercase tracking-wider font-semibold">Raw Frame Payload</p>
          {diag.lastRawJson ? (
            <pre className="text-[11px] text-sky-300 bg-[#07090e] border border-white/[0.08] rounded-lg p-2.5 font-mono leading-relaxed overflow-x-auto max-h-48">
              {(() => { try { return JSON.stringify(JSON.parse(diag.lastRawJson), null, 2); } catch { return diag.lastRawJson; } })()}
            </pre>
          ) : (
            <p className="text-white/30 text-xs italic">Awaiting telemetry frame...</p>
          )}
        </div>

        {/* Validation errors + connection events */}
        <div className="p-3 space-y-3">
          <div>
            <p className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider font-semibold">Frame CRC & Validation Log</p>
            {diag.validationErrors.length === 0 ? (
              <p className="text-emerald-400 text-xs">Zero frame errors detected</p>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {diag.validationErrors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-[11px] text-red-400 font-mono">{e}</p>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] text-white/50 mb-1.5 uppercase tracking-wider font-semibold">Gateway Event Log</p>
            {diag.connectionEvents.length === 0 ? (
              <p className="text-white/30 text-xs italic">No link events</p>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {diag.connectionEvents.slice(0, 15).map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      ev.type === 'connected' ? 'bg-emerald-400'
                      : ev.type === 'error' ? 'bg-red-400'
                      : ev.type === 'disconnected' ? 'bg-amber-400'
                      : 'bg-sky-400'
                    }`} />
                    <span className="text-white/40">{format(new Date(ev.at), 'HH:mm:ss')}</span>
                    <span className="text-white/70 uppercase">{ev.type}</span>
                    {ev.detail && <span className="text-white/30 truncate">{ev.detail}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
