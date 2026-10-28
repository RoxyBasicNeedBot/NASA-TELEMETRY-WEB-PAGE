import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Wifi, WifiOff, Loader2, AlertTriangle, CheckCircle2,
  Package, Clock, AlertCircle, Hash,
} from 'lucide-react';
import type { ConnectionState } from '../../types/telemetry';

function StateDisplay({ state }: { state: ConnectionState }) {
  const configs: Record<ConnectionState, { icon: typeof Wifi; color: string; bg: string; border: string; label: string; desc: string }> = {
    idle:         { icon: Wifi, color: 'text-zinc-400', bg: 'bg-white/[0.03]', border: 'border-white/10', label: 'IDLE', desc: 'Telemetry daemon paused' },
    connecting:   { icon: Loader2, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', label: 'CONNECTING', desc: 'Handshake in progress…' },
    connected:    { icon: CheckCircle2, color: 'text-[#10a37f]', bg: 'bg-[#10a37f]/10', border: 'border-[#10a37f]/20', label: 'LINK ONLINE', desc: 'Flight telemetry nominal' },
    disconnected: { icon: WifiOff, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'DISCONNECTED', desc: 'Awaiting ground bridge…' },
    stale:        { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'LINK STALE', desc: 'No packets received >10s' },
    error:        { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'LINK ERROR', desc: 'Socket connection failed' },
  };
  const cfg = configs[state];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl ${cfg.bg} border ${cfg.border} font-sans`}>
      <Icon size={16} className={`${cfg.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <div>
        <p className={`text-xs font-semibold tracking-wide ${cfg.color}`}>{cfg.label}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">{cfg.desc}</p>
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
    { icon: Package, label: 'Received', value: diag.received.toLocaleString(), color: 'text-white' },
    { icon: AlertTriangle, label: 'Invalid', value: diag.invalid.toString(), color: diag.invalid > 0 ? 'text-rose-400' : 'text-zinc-500' },
    { icon: Hash, label: 'Last packet', value: diag.lastPacketNo?.toString() ?? '—', color: 'text-zinc-300' },
    { icon: Clock, label: 'Last ping', value: lastSeen, color: 'text-zinc-300' },
  ];

  return (
    <div className="h-full flex flex-col p-3.5 space-y-3 bg-[#242424] font-sans">
      <StateDisplay state={state} />

      <div className="text-[11px] text-zinc-500 font-mono truncate px-1">Endpoint: {wsUrl}</div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#2f2f2f] rounded-xl p-2.5 border border-white/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-zinc-400" />
              <span className="text-zinc-400 text-[10px] tracking-wide">{label}</span>
            </div>
            <p className={`text-xs font-mono font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {diag.lastRawJson && (
        <div className="flex-1 min-h-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 px-1 font-medium">Raw Frame Buffer</p>
          <pre className="text-[11px] text-[#10a37f] bg-[#1a1a1a] border border-white/5 rounded-xl p-2.5 overflow-auto h-full font-mono leading-relaxed">
            {(() => { try { return JSON.stringify(JSON.parse(diag.lastRawJson), null, 2); } catch { return diag.lastRawJson; } })()}
          </pre>
        </div>
      )}
    </div>
  );
}
