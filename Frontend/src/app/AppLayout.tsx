import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Satellite, LayoutDashboard, Radio, BarChart2, Cpu, Database,
  Settings, Wifi, WifiOff, Loader2, AlertTriangle, Clock, Package,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMissionStore } from '../stores/missionStore';
import { sensorRegistry } from '../features/sensors/registry';
import { format } from 'date-fns';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// App Layout â€” Black Hole VYOMAASTRA + Apple Liquid Glass
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/explorer', icon: Radio, label: 'Telemetry Explorer' },
  { to: '/plots', icon: BarChart2, label: 'Plot Builder' },
  { to: '/sensors', icon: Cpu, label: 'Sensors' },
  { to: '/history', icon: Database, label: 'Data History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function ConnectionBadge() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const lastTs = diag.lastTimestamp;

  const config = {
    idle:         { icon: Wifi, color: 'text-slate-400', bg: 'bg-white/[0.03]', dot: 'bg-slate-400', label: 'IDLE' },
    connecting:   { icon: Loader2, color: 'text-sky-400', bg: 'bg-sky-500/10', dot: 'bg-sky-400 animate-pulse', label: 'CONNECTING' },
    connected:    { icon: Wifi, color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]', label: 'LINK ONLINE' },
    disconnected: { icon: WifiOff, color: 'text-rose-400', bg: 'bg-rose-500/10', dot: 'bg-rose-400', label: 'DISCONNECTED' },
    stale:        { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', label: 'LINK STALE' },
    error:        { icon: WifiOff, color: 'text-rose-400', bg: 'bg-rose-500/10', dot: 'bg-rose-400', label: 'LINK ERROR' },
  }[state];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${config.bg} border border-white/10 font-mono text-[11px]`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <Icon size={12} className={`${config.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <span className={`font-semibold ${config.color} hidden sm:block tracking-wider`}>{config.label}</span>
      {lastTs && state === 'connected' && (
        <span className="text-slate-400 hidden lg:block font-mono">
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
    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono hidden md:flex">
      <Clock size={12} className="text-sky-400" />
      <span>{format(time, 'yyyy-MM-dd HH:mm:ss')} UTC</span>
    </div>
  );
}

function PacketCounter() {
  const received = useTelemetryStore(s => s.diagnostics.received);
  const invalid = useTelemetryStore(s => s.diagnostics.invalid);
  const lastPacketNo = useTelemetryStore(s => s.diagnostics.lastPacketNo);
  return (
    <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
      {lastPacketNo !== null && (
        <span className="text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
          PKT #{lastPacketNo}
        </span>
      )}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-md">
        <Package size={12} className="text-slate-400" />
        <span className="text-slate-200 font-medium">{received.toLocaleString()}</span>
        {invalid > 0 && <span className="text-rose-400">/ {invalid} bad</span>}
      </div>
    </div>
  );
}

function SensorIndicators() {
  const configuredIds = useMissionStore(s => s.configuredSensorIds);
  const connState = useTelemetryStore(s => s.connectionState);
  const sensors = sensorRegistry.getAllSensors();

  return (
    <div className="hidden xl:flex items-center gap-1.5">
      {sensors.map(s => {
        const isConfigured = configuredIds.includes(s.sensorId);
        if (!isConfigured) return null;

        const isLive = s.status === 'receiving' && connState === 'connected';
        const isStale = s.status === 'stale' || connState === 'stale';

        const dotColor = isLive ? 'bg-[#c026d3] shadow-[0_0_8px_#c026d3]'
          : isStale ? 'bg-[#FF9F0A]'
          : 'bg-white/20';

        const textColor = isLive ? 'text-white/90'
          : isStale ? 'text-[#FF9F0A]'
          : 'text-white/40';

        return (
          <div
            key={s.sensorId}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131929] border border-white/[0.08] text-[10px] font-mono tracking-tight"
            title={`${s.displayName}: ${s.status}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className={textColor}>{s.displayName}</span>
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
    <div className="flex flex-col h-screen text-slate-100 overflow-hidden bg-[#07090e]">
      {/* Precision Aerospace Header */}
      <header className="flex items-center gap-4 px-4 py-2 shrink-0 z-30 bg-[#0c0f18] border-b border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shrink-0">
            <Satellite size={15} className="text-sky-400" />
          </div>
          <div className="hidden sm:flex items-center gap-2 font-mono">
            <span className="font-bold tracking-tight text-xs text-white">SINGULARITY</span>
            <span className="text-[10px] text-sky-400 font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
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
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
            title="Settings"
          >
            <Settings size={14} />
          </NavLink>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sleek Compact Sidebar */}
        <aside
          className={`flex flex-col shrink-0 border-r border-white/[0.08] bg-[#090c14] z-20 transition-all duration-150 ${
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
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-mono transition-colors group ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-200 font-semibold border-l-2 border-sky-400 pl-2'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={15}
                      className={`shrink-0 ${
                        isActive
                          ? 'text-sky-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate uppercase tracking-wider text-[11px]">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="p-1.5 border-t border-white/[0.08]">
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="w-full flex items-center justify-center p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 bg-[#07090e]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
