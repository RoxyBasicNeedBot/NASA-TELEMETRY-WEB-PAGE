import { useState } from 'react';
import { Cpu, RefreshCw, ToggleLeft, ToggleRight, AlertTriangle, Clock, MapPin, Gauge, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sensorRegistry } from './registry';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { telemetryService } from '../../services/telemetryService';
import { SetupWizard } from '../setup/SetupWizard';
import type { SensorStatus } from '../../types/telemetry';

const SENSOR_ICONS: Record<string, React.ElementType> = {
  mpu6050: Activity,
  bme280: Gauge,
  gps: MapPin,
};

function StatusBadge({ status }: { status: SensorStatus }) {
  const cfg: Record<SensorStatus, { color: string; label: string }> = {
    configured: { color: 'text-zinc-400 bg-white/5 border-white/10', label: 'Configured' },
    receiving:  { color: 'text-[#10a37f] bg-[#10a37f]/10 border-[#10a37f]/30', label: 'Active' },
    stale:      { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: 'Stale' },
    error:      { color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', label: 'Error' },
    disabled:   { color: 'text-zinc-500 bg-white/[0.02] border-white/5', label: 'Offline' },
  };
  const c = cfg[status];
  return (
    <span className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border ${c.color}`}>{c.label}</span>
  );
}

export function SensorsPage() {
  const latestValues = useTelemetryStore(s => s.latestValues);
  const mission = useMissionStore();
  const [sensors, setSensors] = useState(() => sensorRegistry.getAllSensors());
  const [showWizard, setShowWizard] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = () => setSensors(sensorRegistry.getAllSensors());

  const toggleSensor = (sensorId: string, enabled: boolean) => {
    sensorRegistry.updateSensor(sensorId, { enabled, status: enabled ? 'configured' : 'disabled' });
    const newEnabled = sensors.filter(s => s.enabled).map(s => s.sensorId);
    const updated = enabled
      ? [...newEnabled.filter(id => id !== sensorId), sensorId]
      : newEnabled.filter(id => id !== sensorId);
    mission.updateConfig({ configuredSensorIds: updated });
    useDashboardStore.getState().syncSensorsWithLayout(updated);
    telemetryService.configure({
      wsUrl: mission.wsUrl,
      deviceId: mission.deviceId,
      missionId: mission.missionName,
      enabledSensorIds: updated,
    });
    refresh();
  };

  if (showWizard) {
    return (
      <div className="bg-[#212121] min-h-full">
        <div className="p-3 border-b border-white/5 flex items-center gap-3 bg-[#171717]">
          <button onClick={() => setShowWizard(false)} className="text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors">
            ← Return to sensor bus
          </button>
        </div>
        <SetupWizard />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-w-5xl mx-auto bg-[#212121]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Cpu size={18} className="text-[#10a37f]" /> Payload Sensors Bus
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Avionics registers, status polling, and telemetry telemetry channel diagnostics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#2f2f2f] border border-white/10 rounded-full transition-colors"
            title="Scan bus"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-full text-xs font-medium transition-colors shadow-sm"
          >
            <RefreshCw size={12} /> Reconfigure hardware
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {sensors.map(sensor => {
          const Icon = SENSOR_ICONS[sensor.sensorId] ?? Cpu;
          const isExpanded = expandedId === sensor.sensorId;
          const lastSeen = sensor.lastSeenTimestamp
            ? formatDistanceToNow(new Date(sensor.lastSeenTimestamp), { addSuffix: true })
            : null;

          return (
            <div key={sensor.sensorId} className="bg-[#2a2a2a] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <div
                className="flex items-center gap-3.5 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : sensor.sensorId)}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${sensor.enabled ? 'bg-[#10a37f]/10 border border-[#10a37f]/20 text-[#10a37f]' : 'bg-white/[0.03] border border-white/5 text-zinc-600'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${sensor.enabled ? 'text-white' : 'text-zinc-500'}`}>
                      {sensor.displayName}
                    </span>
                    <StatusBadge status={sensor.status} />
                  </div>
                  <p className="text-zinc-400 text-xs mt-0.5 truncate">{sensor.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {lastSeen && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 hidden sm:flex">
                      <Clock size={11} className="text-[#10a37f]" />
                      {lastSeen}
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSensor(sensor.sensorId, !sensor.enabled); }}
                    className="transition-colors text-zinc-400 hover:text-white"
                    title={sensor.enabled ? 'Disable sensor' : 'Enable sensor'}
                  >
                    {sensor.enabled
                      ? <ToggleRight size={26} className="text-[#10a37f]" />
                      : <ToggleLeft size={26} className="text-zinc-600" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/5 px-4 py-3.5 space-y-3 bg-[#242424]">
                  <div>
                    <p className="text-[10px] text-[#10a37f] mb-2 uppercase tracking-wider font-semibold">
                      Registered Channel Telemetry
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sensor.fields.map(field => {
                        const ref = `${sensor.sensorId}.${field.fieldKey}`;
                        const value = latestValues[ref] ?? null;
                        return (
                          <div key={field.fieldKey} className="bg-[#2a2a2a] rounded-xl p-2.5 border border-white/5">
                            <p className="text-zinc-400 text-[10px] truncate">{field.label}</p>
                            {value !== null ? (
                              <p className="text-white text-xs font-mono font-semibold mt-0.5">
                                {value.toFixed(field.precision ?? 2)} <span className="text-zinc-500 text-[10px] font-normal">{field.unit}</span>
                              </p>
                            ) : (
                              <p className="text-zinc-600 text-[10px] font-mono mt-0.5">N/A</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!sensor.enabled && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 font-mono">
                      <AlertTriangle size={12} className="text-amber-400" />
                      Channel bus disabled. Enable payload adapter to restore live polling.
                    </div>
                  )}

                  {sensor.enabled && sensor.status === 'configured' && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400 bg-[#2a2a2a] border border-white/5 rounded-xl px-3 py-2 font-mono">
                      <Clock size={12} className="text-[#10a37f]" />
                      Awaiting initial packet transmission from telemetry link.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
