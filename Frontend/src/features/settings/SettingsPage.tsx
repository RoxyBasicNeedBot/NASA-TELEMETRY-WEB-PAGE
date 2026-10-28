import { useState } from 'react';
import { Settings, RotateCcw, Trash2, Wifi, RefreshCw, AlertTriangle, Check } from 'lucide-react';
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
    <div className="p-6 space-y-5 max-w-3xl mx-auto bg-[#212121] text-[#ececec] font-sans">
      <div className="flex items-center gap-3 pb-3 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-[#10a37f]/10 border border-[#10a37f]/20 flex items-center justify-center">
          <Settings size={18} className="text-[#10a37f]" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">System Configuration</h1>
          <p className="text-zinc-400 text-xs">Avionics telemetry connection parameters and layout state</p>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-[#2a2a2a] border border-white/5 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-[#10a37f]" />
          <h2 className="text-xs font-semibold text-white">Telemetry Uplink & WebSocket</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">WebSocket Endpoint URL</label>
            <input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              className="w-full bg-[#242424] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#10a37f]"
              placeholder="ws://localhost:3001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Mission Call Sign</label>
              <input
                value={missionName}
                onChange={e => setMissionName(e.target.value)}
                className="w-full bg-[#242424] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#10a37f]"
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1 font-medium">Hardware Node ID</label>
              <input
                value={deviceId}
                onChange={e => setDeviceId(e.target.value)}
                className="w-full bg-[#242424] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#10a37f]"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-full text-xs font-medium transition-all shadow-sm active:scale-[0.98]"
        >
          {saved ? <Check size={14} className="text-[#10a37f]" /> : null}
          <span>{saved ? 'Settings saved' : 'Save connection'}</span>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#2a2a2a] border border-white/5 rounded-2xl p-4 space-y-3 shadow-sm">
        <h2 className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Mission State Reset
        </h2>
        <p className="text-xs text-zinc-400">
          Reset local telemetry buffer caches, widget grid positions, and restore default layouts.
        </p>

        <div className="flex gap-2 pt-1">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetAll}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-medium"
              >
                Confirm reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 bg-[#383838] hover:bg-[#444] text-zinc-300 rounded-full text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#383838] hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs transition-colors"
            >
              <Trash2 size={13} /> Reset dashboard layout
            </button>
          )}

          <button
            onClick={handleReconfigureMission}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#383838] hover:bg-[#444] text-zinc-300 rounded-full text-xs transition-colors"
          >
            <RefreshCw size={13} /> Relaunch setup wizard
          </button>
        </div>
      </div>
    </div>
  );
}
