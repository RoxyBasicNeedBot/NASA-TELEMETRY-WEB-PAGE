import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare, LayoutDashboard, Radio, BarChart2, Cpu, Database,
  Settings, Wifi, WifiOff, Loader2, AlertTriangle, Clock, Package,
  PanelLeftClose, PanelLeft, SquarePen, Search, ChevronDown, Check,
  Sparkles, ExternalLink, User, Sliders
} from 'lucide-react';
import { OrbitraLogo } from '../components/common/OrbitraLogo';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMissionStore } from '../stores/missionStore';
import { sensorRegistry } from '../features/sensors/registry';
import { format } from 'date-fns';

interface ModelOption {
  id: string;
  name: string;
  tag: string;
  description: string;
}

const MODELS: ModelOption[] = [
  {
    id: 'orbitra-4o',
    name: 'Orbitra 4o',
    tag: 'Fast & Intelligent',
    description: 'Real-time telemetry analysis, attitude kinematics, and automated subsystem monitoring.',
  },
  {
    id: 'orbitra-o1',
    name: 'Orbitra o1 Deep Reasoner',
    tag: 'Deep Physics',
    description: 'Extended reasoning for attitude quaternions, Kalman filter tuning, and orbital state vectors.',
  },
  {
    id: 'stream-v2',
    name: 'Telemetry Stream v2',
    tag: 'Low-latency',
    description: 'Direct binary packet decoder with high-speed CRC-16 checksum validation.',
  },
];

const NAV_CHANNELS = [
  { to: '/copilot', icon: MessageSquare, label: 'Telemetry Copilot', exact: true, badge: 'AI' },
  { to: '/', icon: LayoutDashboard, label: 'Flight Dashboard', exact: true },
  { to: '/sensors', icon: Cpu, label: 'Payload Sensors Bus' },
  { to: '/plots', icon: BarChart2, label: 'Plot Designer' },
  { to: '/explorer', icon: Radio, label: 'Telemetry Explorer' },
  { to: '/history', icon: Database, label: 'Flight Log Archive' },
  { to: '/settings', icon: Settings, label: 'Mission Configuration' },
];

const RECENT_CHATS = [
  { id: '1', title: '1U CubeSat Attitude Stability', time: '10m ago' },
  { id: '2', title: 'MPU-6050 Calibration Run #42', time: '1h ago' },
  { id: '3', title: 'Solar Array EPS Bus Voltage', time: 'Yesterday' },
  { id: '4', title: 'UHF Deployable Antenna Check', time: '2d ago' },
];

function ConnectionBadge() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const lastTs = diag.lastTimestamp;

  const config = {
    idle:         { icon: Wifi, color: 'text-zinc-400', bg: 'bg-white/[0.04]', dot: 'bg-zinc-400', label: 'IDLE' },
    connecting:   { icon: Loader2, color: 'text-sky-400', bg: 'bg-sky-500/10', dot: 'bg-sky-400 animate-pulse', label: 'CONNECTING' },
    connected:    { icon: Wifi, color: 'text-[#10a37f]', bg: 'bg-[#10a37f]/10', dot: 'bg-[#10a37f] shadow-[0_0_8px_#10a37f]', label: 'LINK ONLINE' },
    disconnected: { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', label: 'OFFLINE' },
    stale:        { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', label: 'STALE' },
    error:        { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', label: 'ERROR' },
  }[state];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/10 font-mono text-[11px] ${config.bg}`}>
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
      <Clock size={12} className="text-zinc-500" />
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
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#171717] border border-white/10 rounded-full">
        <Package size={12} className="text-zinc-400" />
        <span className="text-white font-medium">{received.toLocaleString()}</span>
        {invalid > 0 && <span className="text-red-400">/ {invalid} err</span>}
      </div>
    </div>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS[0]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const missionName = useMissionStore(s => s.missionName);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-screen text-[#ececec] overflow-hidden bg-[#212121] font-sans">
      {/* ── Top ChatGPT Navigation Bar ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3.5 py-2 shrink-0 z-30 bg-[#212121] border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#2f2f2f] transition-colors"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          {/* ChatGPT Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <button
              onClick={() => setShowModelMenu(m => !m)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white hover:bg-[#2f2f2f] transition-colors group"
            >
              <div className="w-5 h-5 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0">
                <OrbitraLogo size={12} theme="monochrome" />
              </div>
              <span className="tracking-tight">{selectedModel.name}</span>
              <ChevronDown size={14} className="text-zinc-400 group-hover:text-white transition-transform duration-150" />
            </button>

            {/* Model Dropdown Menu */}
            {showModelMenu && (
              <div className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-[#2f2f2f] border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Model Selector
                </div>
                <div className="space-y-1">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m);
                        setShowModelMenu(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between ${
                        selectedModel.id === m.id
                          ? 'bg-[#383838] text-white shadow-sm'
                          : 'text-zinc-300 hover:bg-[#343434] hover:text-white'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white">{m.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#10a37f]/20 text-[#10a37f] font-medium">
                            {m.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-tight">{m.description}</p>
                      </div>
                      {selectedModel.id === m.id && (
                        <Check size={14} className="text-[#10a37f] shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Tab Switcher (Copilot Chat vs Dashboard) */}
          <div className="hidden sm:flex items-center bg-[#171717] p-1 rounded-xl border border-white/5">
            <NavLink
              to="/copilot"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2f2f2f] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`
              }
            >
              <MessageSquare size={13} className="text-[#10a37f]" />
              <span>Copilot Chat</span>
            </NavLink>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#2f2f2f] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`
              }
            >
              <LayoutDashboard size={13} className="text-sky-400" />
              <span>Dashboard</span>
            </NavLink>
          </div>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-2.5">
          <UtcClock />
          <PacketCounter />
          <ConnectionBadge />
          <NavLink
            to="/settings"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#2f2f2f] rounded-lg transition-colors"
            title="Mission Configuration"
          >
            <Settings size={16} />
          </NavLink>
        </div>
      </header>

      {/* ── Main Layout (Sidebar + Content Canvas) ─────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ChatGPT Style Sidebar */}
        <aside
          className={`flex flex-col shrink-0 bg-[#171717] border-r border-white/5 z-20 transition-all duration-200 select-none ${
            sidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden border-none'
          }`}
        >
          {/* Top Actions: New Session */}
          <div className="p-3 space-y-2">
            <button
              onClick={() => navigate('/copilot')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#212121] hover:bg-[#282828] border border-white/10 text-white text-xs font-medium transition-all shadow-sm group"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#10a37f]/20 flex items-center justify-center text-[#10a37f]">
                  <SquarePen size={12} />
                </div>
                <span>New telemetry chat</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">⌘K</span>
            </button>

            {/* Quick Filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search telemetry..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#212121] text-xs text-white placeholder-zinc-500 border border-white/5 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          {/* Navigation Channels */}
          <div className="flex-1 overflow-y-auto px-2 space-y-4">
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                Mission Views
              </div>
              <div className="space-y-0.5 mt-1">
                {NAV_CHANNELS.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase())).map(({ to, icon: Icon, label, exact, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all group ${
                        isActive
                          ? 'bg-[#212121] text-white font-medium shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-[#212121]/60'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className="shrink-0 text-zinc-400 group-hover:text-white transition-colors" />
                      <span className="truncate">{label}</span>
                    </div>
                    {badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#10a37f]/20 text-[#10a37f] font-mono">
                        {badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Recent Chats / Telemetry Feeds */}
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                Recent Intelligence
              </div>
              <div className="space-y-0.5 mt-1">
                {RECENT_CHATS.map(rc => (
                  <button
                    key={rc.id}
                    onClick={() => navigate('/copilot')}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-[#212121]/60 transition-colors flex items-center justify-between group"
                  >
                    <span className="truncate">{rc.title}</span>
                    <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400 shrink-0 font-mono">
                      {rc.time}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Profile Bar at Bottom (ChatGPT Style) */}
          <div className="p-3 border-t border-white/5 bg-[#171717]">
            <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#212121] transition-colors cursor-pointer group">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#10a37f] to-sky-400 flex items-center justify-center text-black font-bold text-xs shadow">
                  FC
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">Flight Commander</div>
                  <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f]" />
                    <span>Orbitra Pro · 4o</span>
                  </div>
                </div>
              </div>
              <Settings size={15} className="text-zinc-500 group-hover:text-white transition-colors shrink-0" />
            </div>
          </div>
        </aside>

        {/* ── Main Canvas ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto min-w-0 bg-[#212121]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
