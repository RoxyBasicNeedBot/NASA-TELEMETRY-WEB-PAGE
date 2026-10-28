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
    configured: { color: 'text-white/50 bg-white/[0.06] border-white/[0.1]', label: 'CONFIGURED' },
    receiving:  { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'ACTIVE' },
    stale:      { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: 'STALE' },
    error:      { color: 'text-red-400 bg-red-500/10 border-red-500/30', label: 'ERROR' },
    disabled:   { color: 'text-white/30 bg-white/[0.02] border-white/[0.06]', label: 'OFFLINE' },
  };
  const c = cfg[status];
  return (
    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${c.color}`}>{c.label}</span>
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
      <div>
        <div className="p-3 border-b border-white/[0.08] flex items-center gap-3 bg-[#0d111c]">
          <button onClick={() => setShowWizard(false)} className="text-white/70 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors">
            ← Return to Sensor Bus
          </button>
        </div>
        <SetupWizard />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
            <Cpu size={16} className="text-sky-400" /> Sensor Payload Bus
          </h1>
          <p className="text-white/40 text-xs font-mono mt-0.5">Avionics sensor bus registers, status polling, and telemetry telemetry channel diagnostics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10 rounded transition-colors"
            title="Scan bus"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black rounded text-xs font-mono uppercase tracking-wider font-semibold transition-colors"
          >
            <RefreshCw size={12} /> Reconfigure Hardware
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sensors.map(sensor => {
          const Icon = SENSOR_ICONS[sensor.sensorId] ?? Cpu;
          const isExpanded = expandedId === sensor.sensorId;
          const lastSeen = sensor.lastSeenTimestamp
            ? formatDistanceToNow(new Date(sensor.lastSeenTimestamp), { addSuffix: true })
            : null;

          return (
            <div key={sensor.sensorId} className="bg-[#08080a] border border-white/10 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : sensor.sensorId)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${sensor.enabled ? 'bg-sky-500/10 border border-sky-400/30 text-sky-400' : 'bg-white/[0.03] border border-white/[0.06] text-white/30'}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-xs font-semibold ${sensor.enabled ? 'text-white' : 'text-white/40'}`}>
                      {sensor.displayName}
                    </span>
                    <StatusBadge status={sensor.status} />
                  </div>
                  <p className="text-white/40 text-[11px] font-mono mt-0.5 truncate">{sensor.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {lastSeen && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-white/40 hidden sm:flex">
                      <Clock size={11} className="text-sky-400" />
                      {lastSeen}
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSensor(sensor.sensorId, !sensor.enabled); }}
                    className="transition-colors text-white/60 hover:text-white"
                    title={sensor.enabled ? 'Disable sensor' : 'Enable sensor'}
                  >
                    {sensor.enabled
                      ? <ToggleRight size={24} className="text-sky-400" />
                      : <ToggleLeft size={24} className="text-white/30" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/[0.08] px-4 py-3 space-y-3 bg-[#090c14]">
                  <div>
                    <p className="text-[10px] font-mono text-sky-400 mb-2 uppercase tracking-wider font-semibold">
                      Registered Channel Telemetry
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sensor.fields.map(field => {
                        const ref = `${sensor.sensorId}.${field.fieldKey}`;
                        const value = latestValues[ref] ?? null;
                        return (
                          <div key={field.fieldKey} className="bg-[#131929] rounded-lg p-2 border border-white/[0.06]">
                            <p className="text-white/40 text-[10px] font-mono truncate">{field.label}</p>
                            {value !== null ? (
                              <p className="text-white text-xs font-mono font-semibold mt-0.5">
                                {value.toFixed(field.precision ?? 2)} <span className="text-white/40 text-[10px] font-normal">{field.unit}</span>
                              </p>
                            ) : (
                              <p className="text-white/20 text-[10px] font-mono mt-0.5">N/A</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!sensor.enabled && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 font-mono">
                      <AlertTriangle size={12} className="text-amber-400" />
                      Channel bus disabled. Enable payload adapter to restore live polling.
                    </div>
                  )}

                  {sensor.enabled && sensor.status === 'configured' && (
                    <div className="flex items-center gap-2 text-xs text-white/50 bg-[#131929] border border-white/[0.06] rounded-lg px-3 py-2 font-mono">
                      <Clock size={12} className="text-sky-400" />
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
