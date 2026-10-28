import { useState } from 'react';
import { Settings, RotateCcw, Trash2, Wifi, RefreshCw, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { useMissionStore } from '../../stores/missionStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { telemetryService } from '../../services/telemetryService';

export function SettingsPage() {
  const mission = useMissionStore();
  const clearHistory = useTelemetryStore(s => s.clearHistory);
  const resetLayout = useDashboardStore(s => s.resetToDefault);

  const [wsUrl, setWsUrl] = useState(mission.wsUrl);
  const [missionName, setMissionName] = useState(mission.missionName);
  const [deviceId, setDeviceId] = useState(mission.deviceId);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = () => {
    mission.updateConfig({ wsUrl, missionName, deviceId });
    telemetryService.stop();
    setTimeout(() => {
      telemetryService.configure({
        wsUrl, deviceId, missionId: missionName,
        enabledSensorIds: mission.configuredSensorIds,
      });
      telemetryService.start();
    }, 300);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetAll = () => {
    clearHistory();
    resetLayout(mission.configuredSensorIds);
    setConfirmReset(false);
  };

  const handleReconfigureMission = () => {
    mission.resetSetup();
    window.location.reload();
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl font-mono">
      <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.08]">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center">
          <Settings size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide uppercase text-white">System Configuration</h1>
          <p className="text-white/40 text-[11px]">Avionics telemetry connection parameters and layout state</p>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-[#08080a] border border-white/10 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-white" />
          <h2 className="text-xs uppercase font-semibold tracking-wider text-white">Telemetry Uplink / WebSocket</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Mission Identifier</label>
            <input
              value={missionName}
              onChange={e => setMissionName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Transponder Call Sign / Device ID</label>
            <input
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">WebSocket Gateway Endpoint</label>
            <input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              className="w-full bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
            <p className="text-[10px] text-zinc-500 mt-1">Default local telemetry bridge: ws://localhost:8081</p>
          </div>
        </div>
        <div className="pt-2">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-white hover:bg-zinc-200 text-black'
            }`}
          >
            {saved ? <Check size={14} /> : <RefreshCw size={14} className={saved ? 'animate-spin' : ''} />}
            {saved ? 'Reconnecting...' : 'Save & Reconnect Link'}
          </button>
        </div>
      </div>

      {/* Mission configuration */}
      <div className="bg-[#08080a] border border-white/10 rounded-lg p-4 space-y-3">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-white">Payload Configuration State</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Setup Verified', mission.isSetupComplete ? 'YES' : 'NO'],
            ['Configuration Version', String(mission.setupVersion)],
            ['Active Sensor Buses', mission.configuredSensorIds.join(', ') || 'NONE'],
            ['Initialized At', new Date(mission.createdAt).toLocaleDateString()],
            ['Last Synchronized', new Date(mission.updatedAt).toLocaleTimeString()],
          ].map(([k, v]) => (
            <div key={k} className="bg-black border border-white/10 rounded p-2">
              <p className="text-zinc-500 text-[10px]">{k}</p>
              <p className="text-white text-xs mt-0.5 truncate">{v}</p>
            </div>
          ))}
        </div>
        <div className="pt-1">
          <button
            onClick={handleReconfigureMission}
            className="flex items-center gap-2 px-3 py-1.5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded text-xs uppercase tracking-wider transition-colors"
          >
            <RotateCcw size={12} /> Launch Mission Hardware Wizard
          </button>
        </div>
      </div>

      {/* Dashboard Layout */}
      <div className="bg-[#08080a] border border-white/10 rounded-lg p-4 space-y-2.5">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-white">Flight Console Grid</h2>
        <button
          onClick={() => resetLayout(mission.configuredSensorIds)}
          className="flex items-center gap-2 px-3 py-1.5 border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded text-xs uppercase tracking-wider transition-colors"
        >
          <RotateCcw size={12} /> Reset to Default Grid
        </button>
        <p className="text-[11px] text-zinc-500">Resets widget placements to default aerospace arrangement. Historical storage remains intact.</p>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-red-400 flex items-center gap-2">
          <AlertTriangle size={14} /> Diagnostic Reset
        </h2>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-xs uppercase tracking-wider transition-colors"
          >
            <Trash2 size={12} /> Purge In-Memory Sample Ring Buffer
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-300">Clears current live chart buffers. Persistent archive records remain unchanged.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1 border border-white/[0.1] text-white/70 hover:bg-white/[0.06] rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Confirm Buffer Purge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-[11px] text-white/30 space-y-0.5 px-1 font-mono">
        <p>ORBITRA Flight Control Ground Station System · v1.0.0</p>
        <p>Open Aerospace Standard · Telemetry Link Architecture</p>
      </div>
    </div>
  );
}
