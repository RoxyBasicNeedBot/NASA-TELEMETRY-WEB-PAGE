import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Radio, BarChart2, Cpu, Database,
  Settings, Wifi, WifiOff, Loader2, AlertTriangle, Clock, Package,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { OrbitraLogo } from '../components/common/OrbitraLogo';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMissionStore } from '../stores/missionStore';
import { sensorRegistry } from '../features/sensors/registry';
import { format } from 'date-fns';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/explorer', icon: Radio, label: 'Telemetry Explorer' },
  { to: '/plots', icon: BarChart2, label: 'Plot Designer' },
  { to: '/sensors', icon: Cpu, label: 'Payload Bus' },
  { to: '/history', icon: Database, label: 'Archive Log' },
  { to: '/settings', icon: Settings, label: 'Configuration' },
];

function ConnectionBadge() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const lastTs = diag.lastTimestamp;

  const config = {
    idle:         { icon: Wifi, color: 'text-zinc-400', bg: 'bg-white/[0.04]', dot: 'bg-zinc-400', label: 'IDLE' },
    connecting:   { icon: Loader2, color: 'text-sky-400', bg: 'bg-sky-500/10', dot: 'bg-sky-400 animate-pulse', label: 'CONNECTING' },
    connected:    { icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]', label: 'LINK ONLINE' },
    disconnected: { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', label: 'OFFLINE' },
    stale:        { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', label: 'STALE' },
    error:        { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', label: 'ERROR' },
  }[state];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded border border-white/10 font-mono text-[11px] ${config.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <Icon size={12} className={`${config.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <span className={`font-semibold ${config.color} hidden sm:block tracking-wider`}>{config.label}</span>
      {lastTs && state === 'connected' && (
        <span className="text-zinc-500 hidden lg:block font-mono">
          · {format(new Date(lastTs), 'HH:mm:ss')}
        </span>
      )}
    </div>
  );
}

function UtcClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-mono hidden md:flex">
      <Clock size={12} className="text-zinc-400" />
      <span>{format(time, 'yyyy-MM-dd HH:mm:ss')} UTC</span>
    </div>
  );
}

function PacketCounter() {
  const received = useTelemetryStore(s => s.diagnostics.received);
  const invalid = useTelemetryStore(s => s.diagnostics.invalid);
  const lastPacketNo = useTelemetryStore(s => s.diagnostics.lastPacketNo);
  return (
    <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-zinc-400">
      {lastPacketNo !== null && (
        <span className="text-white bg-white/10 border border-white/15 px-2 py-0.5 rounded text-[11px] font-medium">
          PKT #{lastPacketNo}
        </span>
      )}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black border border-white/10 rounded">
        <Package size={12} className="text-zinc-400" />
        <span className="text-white font-medium">{received.toLocaleString()}</span>
        {invalid > 0 && <span className="text-red-400">/ {invalid} bad</span>}
      </div>
    </div>
  );
}

function SensorIndicators() {
  const configuredIds = useMissionStore(s => s.configuredSensorIds);
  const sensors = sensorRegistry.getAllSensors().filter(s => configuredIds.includes(s.sensorId));

  if (sensors.length === 0) return null;

  return (
    <div className="hidden xl:flex items-center gap-1.5">
      {sensors.map(s => {
        const dotColor =
          s.status === 'receiving'
            ? 'bg-emerald-400'
            : s.status === 'stale'
            ? 'bg-amber-400'
            : s.status === 'error'
            ? 'bg-red-400'
            : 'bg-zinc-600';

        return (
          <div
            key={s.sensorId}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black border border-white/10 text-[10px] font-mono tracking-tight"
            title={`${s.displayName}: ${s.status}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-zinc-300">{s.displayName}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const missionName = useMissionStore(s => s.missionName);

  return (
    <div className="flex flex-col h-screen text-zinc-100 overflow-hidden bg-black">
      {/* Precision AMOLED Aerospace Header */}
      <header className="flex items-center gap-4 px-4 py-2 shrink-0 z-30 bg-black border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <OrbitraLogo size={22} />
          <div className="hidden sm:flex items-center gap-2 font-mono">
            <span className="font-bold tracking-widest text-xs text-white">ORBITRA</span>
            <span className="text-[10px] text-zinc-400 font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10">
              {missionName}
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2.5">
          <SensorIndicators />
          <UtcClock />
          <PacketCounter />
          <ConnectionBadge />
          <NavLink
            to="/settings"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Configuration"
          >
            <Settings size={14} />
          </NavLink>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sleek Compact AMOLED Sidebar */}
        <aside
          className={`flex flex-col shrink-0 border-r border-white/10 bg-black z-20 transition-all duration-150 ${
            sidebarCollapsed ? 'w-[52px]' : 'w-[190px]'
          }`}
        >
          <nav className="flex-1 py-2.5 space-y-0.5 overflow-y-auto px-2">
            {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-mono transition-colors group ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold border-l-2 border-white pl-2'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={15}
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-zinc-400 group-hover:text-zinc-200'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate uppercase tracking-wider text-[11px]">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="p-1.5 border-t border-white/10">
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="w-full flex items-center justify-center p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 bg-black">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
