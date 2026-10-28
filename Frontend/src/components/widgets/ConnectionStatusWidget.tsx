import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Wifi, WifiOff, Loader2, AlertTriangle, CheckCircle2,
  Package, Clock, AlertCircle, Hash,
} from 'lucide-react';
import type { ConnectionState } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Connection Status Widget — Singularity Black Hole Health Monitor
// ─────────────────────────────────────────────────────────────────────────────

function StateDisplay({ state }: { state: ConnectionState }) {
  const configs: Record<ConnectionState, { icon: typeof Wifi; color: string; bg: string; border: string; label: string; desc: string }> = {
    idle:         { icon: Wifi, color: 'text-slate-400', bg: 'bg-white/[0.03]', border: 'border-white/10', label: 'IDLE', desc: 'Telemetry daemon paused' },
    connecting:   { icon: Loader2, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', label: 'CONNECTING', desc: 'Handshake in progress…' },
    connected:    { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'LINK ONLINE', desc: 'Flight telemetry nominal' },
    disconnected: { icon: WifiOff, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'DISCONNECTED', desc: 'Awaiting ground bridge…' },
    stale:        { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'LINK STALE', desc: 'No packets received >10s' },
    error:        { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'LINK ERROR', desc: 'Socket connection failed' },
  };
  const cfg = configs[state];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${cfg.bg} border ${cfg.border} font-mono`}>
      <Icon size={16} className={`${cfg.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <div>
        <p className={`text-xs font-bold tracking-wider ${cfg.color}`}>{cfg.label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{cfg.desc}</p>
      </div>
    </div>
  );
}

export function ConnectionStatusWidget() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const wsUrl = useMissionStore(s => s.wsUrl);

  const lastSeen = diag.lastTimestamp
    ? formatDistanceToNow(new Date(diag.lastTimestamp), { addSuffix: true })
    : '—';

  const stats = [
    { icon: Package, label: 'RECEIVED', value: diag.received.toLocaleString(), color: 'text-sky-300' },
    { icon: AlertTriangle, label: 'INVALID', value: diag.invalid.toString(), color: diag.invalid > 0 ? 'text-rose-400' : 'text-slate-500' },
    { icon: Hash, label: 'LAST PKT', value: diag.lastPacketNo?.toString() ?? '—', color: 'text-slate-200' },
    { icon: Clock, label: 'LAST SEEN', value: lastSeen, color: 'text-slate-200' },
  ];

  return (
    <div className="h-full flex flex-col p-3 space-y-2.5 bg-transparent font-mono">
      <StateDisplay state={state} />

      <div className="text-[10px] text-slate-500 font-mono truncate px-1">ENDPOINT: {wsUrl}</div>

      <div className="grid grid-cols-2 gap-1.5">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#111624] rounded-lg p-2 border border-white/[0.06]">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={11} className="text-slate-500" />
              <span className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-xs font-mono font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {diag.lastRawJson && (
        <div className="flex-1 min-h-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 px-1 font-semibold">RAW FRAME BUFFER</p>
          <pre className="text-[11px] text-emerald-400 bg-[#080b12] border border-white/10 rounded-lg p-2 overflow-auto h-full font-mono leading-relaxed">
            {(() => { try { return JSON.stringify(JSON.parse(diag.lastRawJson), null, 2); } catch { return diag.lastRawJson; } })()}
          </pre>
        </div>
      )}

      {diag.connectionEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-white/40 px-1 font-semibold">Recent Events</p>
          {diag.connectionEvents.slice(0, 3).map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                ev.type === 'connected' ? 'bg-[#c026d3] shadow-[0_0_6px_#c026d3]'
                : ev.type === 'error' ? 'bg-[#FF453A]'
                : ev.type === 'disconnected' ? 'bg-[#FF453A]/80'
                : 'bg-[#7c3aed]'
              }`} />
              <span className="text-white/40 font-mono text-[11px]">{format(new Date(ev.at), 'HH:mm:ss')}</span>
              <span className="text-white/70 capitalize font-medium">{ev.type}</span>
              {ev.detail && <span className="text-white/30 truncate">{ev.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
