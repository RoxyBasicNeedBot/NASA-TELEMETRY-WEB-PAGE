import { useState, useEffect } from 'react';
import { Satellite, Wifi, Loader2, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Thermometer, Compass, Gauge, MapPin, Zap, Check } from 'lucide-react';
import { OrbitraLogo } from '../../components/common/OrbitraLogo';
import { useMissionStore } from '../../stores/missionStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { sensorRegistry } from '../sensors/registry';

type Step = 'welcome' | 'connection' | 'sensors' | 'confirm';
type TestState = 'idle' | 'connecting' | 'connected' | 'failed' | 'stale';

const SENSOR_CARDS = [
  {
    id: 'dht11',
    name: 'DHT11',
    icon: Thermometer,
    description: 'Digital temperature & humidity telemetry sensor',
    fields: ['Temperature (°C)', 'Relative Humidity (%)'],
    border: 'border-sky-500/40',
    iconColor: 'text-sky-400',
    required: true,
  },
  {
    id: 'mpu6050',
    name: 'MPU6050',
    icon: Compass,
    description: '6-axis IMU with accelerometer & gyroscope',
    fields: ['Accel X/Y/Z (m/s²)', 'Gyro X/Y/Z (°/s)'],
    border: 'border-indigo-500/40',
    iconColor: 'text-indigo-400',
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    icon: Gauge,
    description: 'Barometric pressure & altimetry sensor',
    fields: ['Pressure (hPa)', 'Temperature (°C)', 'Altitude (m)'],
    border: 'border-amber-500/40',
    iconColor: 'text-amber-400',
  },
  {
    id: 'gps',
    name: 'GPS / NEO-6M',
    icon: MapPin,
    description: 'Geospatial position, ground speed & satellite fix',
    fields: ['Latitude/Longitude', 'Altitude (m)', 'Speed (km/h)', 'Satellites'],
    border: 'border-emerald-500/40',
    iconColor: 'text-emerald-400',
  },
];

interface ConnectionTestResult {
  state: TestState;
  message: string;
  latestPacket: string | null;
  latencyMs?: number;
}

function ConnectionTester({ wsUrl }: { wsUrl: string }) {
  const [result, setResult] = useState<ConnectionTestResult>({
    state: 'idle',
    message: 'Test WebSocket telemetry link connection.',
    latestPacket: null,
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  const runTest = () => {
    if (ws) { ws.close(); setWs(null); }
    setResult({ state: 'connecting', message: `Connecting to ${wsUrl}...`, latestPacket: null });
    const start = Date.now();
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      setResult({ state: 'failed', message: `Invalid URL: ${(e as Error).message}`, latestPacket: null });
      return;
    }
    setWs(socket);
    const timeout = setTimeout(() => {
      socket.close();
      setResult({ state: 'failed', message: 'Connection timed out (5s). Is local bridge online?', latestPacket: null });
    }, 5000);

    socket.onopen = () => {
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      setResult((r) => ({ ...r, state: 'connected', message: `Uplink established in ${latencyMs}ms. Listening for packets...`, latencyMs }));
    };
    socket.onmessage = (e) => {
      clearTimeout(timeout);
      setResult((r) => ({ ...r, state: 'connected', message: 'Telemetry packet received.', latestPacket: e.data }));
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      setResult({ state: 'failed', message: 'Socket error. Verify bridge daemon and port.', latestPacket: null });
    };
    socket.onclose = () => {
      clearTimeout(timeout);
    };
  };

  useEffect(() => {
    return () => { if (ws) ws.close(); };
  }, [ws]);

  const Icon =
    result.state === 'connecting'
      ? Loader2
      : result.state === 'connected'
      ? CheckCircle2
      : result.state === 'failed'
      ? XCircle
      : Wifi;

  const iconClass =
    result.state === 'connecting'
      ? 'animate-spin text-sky-400'
      : result.state === 'connected'
      ? 'text-emerald-400'
      : result.state === 'failed'
      ? 'text-red-400'
      : 'text-white/40';

  return (
    <div className="space-y-2.5 font-mono">
      <button
        onClick={runTest}
        disabled={result.state === 'connecting'}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#131929] hover:bg-[#1a2236] border border-white/[0.1] text-white rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-40"
      >
        <Wifi size={13} className="text-sky-400" />
        Verify Telemetry Link
      </button>

      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#090c14] border border-white/[0.08]">
        <Icon size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/80">{result.message}</p>
          {result.latestPacket && (
            <pre className="mt-2 text-[11px] text-sky-300 bg-black/60 border border-white/[0.08] p-2 rounded overflow-x-auto font-mono">
              {JSON.stringify(JSON.parse(result.latestPacket), null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

interface SetupWizardProps {
  onLaunch?: () => void;
  launchingMode?: boolean;
}

export function SetupWizard({ onLaunch, launchingMode = false }: SetupWizardProps = {}) {
  const mission = useMissionStore();
  const [step, setStep] = useState<Step>('welcome');
  const [missionName, setMissionName] = useState(mission.missionName);
  const [deviceId, setDeviceId] = useState(mission.deviceId);
  const [wsUrl, setWsUrl] = useState(mission.wsUrl);
  const [selectedSensors, setSelectedSensors] = useState<string[]>(
    mission.isSetupComplete ? mission.configuredSensorIds : ['dht11']
  );

  const toggleSensor = (id: string) => {
    if (id === 'dht11') return;
    setSelectedSensors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleComplete = () => {
    sensorRegistry.enableSensors(selectedSensors);
    useDashboardStore.getState().syncSensorsWithLayout(selectedSensors);
    mission.completeMission({
      missionName,
      deviceId,
      wsUrl,
      configuredSensorIds: selectedSensors,
    });
    if (onLaunch) {
      onLaunch();
    } else {
      window.location.reload();
    }
  };

  const steps: Step[] = ['welcome', 'connection', 'sensors', 'confirm'];
  const stepIdx = steps.indexOf(step);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black font-mono">
      <div className="w-full max-w-xl">
        {/* Step Progress */}
        <div className="mb-4 flex items-center gap-2 px-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded flex items-center justify-center text-xs font-semibold border transition-colors ${
                  i < stepIdx
                    ? 'bg-white border-white text-black'
                    : i === stepIdx
                    ? 'border-white text-white bg-white/10'
                    : 'border-white/10 text-white/30 bg-black'
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded transition-colors ${
                    i < stepIdx ? 'bg-white' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main Panel */}
        <div className="rounded-xl p-6 bg-[#08080a] border border-white/10 shadow-2xl">
          {/* Welcome */}
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <OrbitraLogo size={48} animated={true} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-widest uppercase text-white">ORBITRA GROUND STATION</h1>
                <p className="text-zinc-400 mt-0.5 text-xs">Aerospace Telemetry Link & Payload Control</p>
              </div>
              <div className="bg-black border border-white/10 rounded-lg p-4 text-left space-y-2">
                <h2 className="text-xs font-semibold uppercase text-sky-400 tracking-wider">Mission Commissioning Sequence</h2>
                <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                  Configure avionics transponder call sign, WebSocket telemetry downlink endpoint, and select the active payload sensors.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setStep('connection')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors shadow"
                >
                  Initiate Setup Sequence <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Connection */}
          {step === 'connection' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase text-white tracking-wider">Step 2: Telemetry Link Configuration</h2>
                <p className="text-white/40 text-xs mt-0.5">Specify mission identifiers and websocket gateway</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Mission Call Sign</label>
                  <input
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="ORBITRA-1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Device Transponder ID</label>
                  <input
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="flight-computer-01"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Telemetry WebSocket Endpoint</label>
                  <input
                    value={wsUrl}
                    onChange={e => setWsUrl(e.target.value)}
                    className="w-full bg-[#131929] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                    placeholder="ws://localhost:8081"
                  />
                </div>
                <ConnectionTester wsUrl={wsUrl} />
              </div>
              <div className="flex gap-2.5 pt-3 border-t border-white/[0.08]">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#131929] hover:bg-[#1a2236] border border-white/[0.1] text-white/70 hover:text-white rounded-lg text-xs uppercase tracking-wider transition-colors"
                >
                  <ChevronLeft size={13} /> Back
                </button>
                <button
                  onClick={() => setStep('sensors')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors"
                >
                  Next: Configure Payload <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Sensors */}
          {step === 'sensors' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase text-white tracking-wider">Step 3: Select Active Sensors</h2>
                <p className="text-white/40 text-xs mt-0.5">Toggle hardware payloads integrated into the flight computer</p>
              </div>
              <div className="space-y-2">
                {SENSOR_CARDS.map((card) => {
                  const selected = selectedSensors.includes(card.id);
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleSensor(card.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selected
                          ? 'bg-sky-500/10 border-sky-400/40 text-white'
                          : 'bg-[#131929]/50 border-white/[0.06] text-white/60 hover:bg-[#131929]'
                      } ${card.required ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-[#090c14] border border-white/[0.08] flex items-center justify-center shrink-0 ${card.iconColor}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">{card.name}</span>
                            {card.required && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase">Primary</span>
                            )}
                          </div>
                          <p className="text-white/40 text-[11px] mt-0.5">{card.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {card.fields.map(f => (
                              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/60 border border-white/[0.06]">{f}</span>
                            ))}
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center ${
                          selected ? 'border-sky-400 bg-sky-500 text-white' : 'border-white/20'
                        }`}>
                          {selected && <Check size={10} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2.5 pt-3 border-t border-white/10">
                <button
                  onClick={() => setStep('connection')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white rounded-lg text-xs uppercase tracking-wider transition-colors"
                >
                  <ChevronLeft size={13} /> Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors"
                >
                  Review Configuration <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold uppercase text-white tracking-wider">Step 4: Mission Pre-Flight Review</h2>
                <p className="text-zinc-400 text-xs mt-0.5">Verify parameters before activating flight control dashboard</p>
              </div>
              <div className="space-y-2 bg-black border border-white/10 rounded-lg p-3 text-xs">
                {[
                  ['Mission Identifier', missionName],
                  ['Device Call Sign', deviceId],
                  ['Downlink Gateway', wsUrl],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-1 border-b border-white/[0.04] last:border-0">
                    <span className="text-zinc-400">{label}</span>
                    <span className="text-white font-semibold">{value}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">Payload Adapters</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSensors.map(id => {
                      const card = SENSOR_CARDS.find(c => c.id === id);
                      return card ? (
                        <span key={id} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-white">
                          <card.icon size={11} className={card.iconColor} />
                          <span>{card.name}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5 pt-3 border-t border-white/10">
                <button
                  onClick={() => setStep('sensors')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white rounded-lg text-xs uppercase tracking-wider transition-colors"
                >
                  <ChevronLeft size={13} /> Back
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs uppercase tracking-wider font-semibold transition-colors"
                >
                  <OrbitraLogo size={14} /> Launch Flight Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
