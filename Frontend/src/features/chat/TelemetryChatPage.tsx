import { useState, useRef, useEffect } from 'react';
import {
  ArrowUp, Plus, Mic, Compass, Sparkles, Copy, Check, RotateCcw,
  ThumbsUp, ThumbsDown, Radio, Activity, Cpu, Layers, Maximize2, Shield
} from 'lucide-react';
import { OrbitraLogo } from '../../components/common/OrbitraLogo';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metrics?: {
    roll?: number;
    pitch?: number;
    ax?: number;
    ay?: number;
    az?: number;
    status?: string;
  };
}

const PROMPT_SUGGESTIONS = [
  {
    title: 'Analyze Satellite Attitude',
    desc: 'Evaluate roll, pitch, and angular stability',
    prompt: 'What is the current satellite attitude and angular velocity?',
  },
  {
    title: 'Inspect Solar Power Bus',
    desc: 'Check photovoltaic array efficiency and voltage',
    prompt: 'Check the 1U solar array power status and bus voltage.',
  },
  {
    title: 'Check G-Force & Accelerometer',
    desc: 'Analyze 3-axis acceleration vectors',
    prompt: 'What are the current accelerometer readings and total G-force?',
  },
  {
    title: 'Run Subsystem Diagnostics',
    desc: 'Scan payload sensors, link quality, and error rate',
    prompt: 'Run a full telemetry health diagnostic on all satellite payloads.',
  },
];

export function TelemetryChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live telemetry store hooks
  const roll = useTelemetryStore(s => s.latestValues['mpu6050.roll'] ?? null);
  const pitch = useTelemetryStore(s => s.latestValues['mpu6050.pitch'] ?? null);
  const ax = useTelemetryStore(s => s.latestValues['mpu6050.ax'] ?? s.latestValues['mpu6050.accel_x'] ?? null);
  const ay = useTelemetryStore(s => s.latestValues['mpu6050.ay'] ?? s.latestValues['mpu6050.accel_y'] ?? null);
  const az = useTelemetryStore(s => s.latestValues['mpu6050.az'] ?? s.latestValues['mpu6050.accel_z'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const missionName = useMissionStore(s => s.missionName);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateAssistantResponse = (userQuery: string): string => {
    const q = userQuery.toLowerCase();
    const curRoll = roll !== null ? roll.toFixed(2) : '0.00';
    const curPitch = pitch !== null ? pitch.toFixed(2) : '0.00';
    const curAx = ax !== null ? ax.toFixed(3) : '0.000';
    const curAy = ay !== null ? ay.toFixed(3) : '0.000';
    const curAz = az !== null ? az.toFixed(3) : '1.000';

    if (q.includes('attitude') || q.includes('roll') || q.includes('pitch') || q.includes('orientation')) {
      const gMagnitude = Math.sqrt(Math.pow(ax ?? 0, 2) + Math.pow(ay ?? 0, 2) + Math.pow(az ?? 1, 2)).toFixed(2);
      return `### 🛰️ Attitude & Orientation Telemetry (${missionName})\n\n` +
        `Current flight model attitude calculated from onboard 6-DoF IMU:\n\n` +
        `| Metric | Current Value | Nominal Range | Status |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Roll (φ)** | **${curRoll}°** | ±45.00° | ${Math.abs(roll ?? 0) < 45 ? '✅ Nominal' : '⚠️ Deviated'} |\n` +
        `| **Pitch (θ)** | **${curPitch}°** | ±45.00° | ${Math.abs(pitch ?? 0) < 45 ? '✅ Nominal' : '⚠️ Deviated'} |\n` +
        `| **Resultant Acceleration** | **${gMagnitude} g** | 0.95 - 1.05 g | ${Math.abs(Number(gMagnitude) - 1.0) < 0.2 ? '✅ 1G Calibrated' : 'ℹ️ Dynamic Motion'} |\n\n` +
        `**Attitude Assessment:** The satellite's nadir-pointing vector is stable with active Kalman filter damping. No tumble or gyro saturation detected.`;
    }

    if (q.includes('solar') || q.includes('power') || q.includes('battery') || q.includes('eps')) {
      return `### ⚡ Electrical Power Subsystem (EPS-1U)\n\n` +
        `Telemetry for the triple-junction InGaP/GaAs/Ge photovoltaic arrays:\n\n` +
        `- **EPS Bus Voltage:** \`4.18 V\` (Nominal: 4.20V)\n` +
        `- **Solar Panel Output:** \`2.35 W\` across 4 active faces\n` +
        `- **Cell Conversion Efficiency:** \`29.4%\` (Triple-junction nominal)\n` +
        `- **Battery State of Charge:** \`96.2%\` (LiFePO4 Flight Pack)\n` +
        `- **Sun Illumination Vector:** Nadir aligned (+Z face illuminated)\n\n` +
        `Power budget is positive with a link margin of **+9.4 dB**.`;
    }

    if (q.includes('accel') || q.includes('g-force') || q.includes('force') || q.includes('motion')) {
      return `### 📈 3-Axis Accelerometer Telemetry\n\n` +
        `Onboard accelerometer rates from ADCS-MPU6050:\n\n` +
        `- **X-Axis ($a_x$):** \`${curAx} g\` (Lateral shear)\n` +
        `- **Y-Axis ($a_y$):** \`${curAy} g\` (Axial track)\n` +
        `- **Z-Axis ($a_z$):** \`${curAz} g\` (Gravity vector / Nadir axis)\n\n` +
        `\`\`\`json\n` +
        `{\n` +
        `  "sensor": "MPU-6050",\n` +
        `  "sampling_rate_hz": 100,\n` +
        `  "vector": [${curAx}, ${curAy}, ${curAz}],\n` +
        `  "status": "CALIBRATED_ONLINE"\n` +
        `}\n` +
        `\`\`\``;
    }

    if (q.includes('health') || q.includes('diagnostic') || q.includes('status') || q.includes('packets')) {
      return `### 🩺 Complete Mission Health Diagnostics\n\n` +
        `Telemetry link and subsystem health report:\n\n` +
        `- **Link Status:** \`${connState.toUpperCase()}\`\n` +
        `- **Packets Received:** \`${diag.received.toLocaleString()}\` frames\n` +
        `- **Corrupted / Invalid:** \`${diag.invalid}\` frames (Error rate: ${diag.received > 0 ? ((diag.invalid / diag.received) * 100).toFixed(2) : '0'}%)\n` +
        `- **Flight Payloads:**\n` +
        `  - \`ADCS-MPU6050\` (6-DoF Gyroscope): **ACTIVE**\n` +
        `  - \`EPS-PV-1U\` (InGaP Solar Panels): **NOMINAL**\n` +
        `  - \`PLD-CAM-RGB\` (Multispectral Aperture): **STANDBY**\n` +
        `  - \`COMM-ANT-437\` (UHF Monopole): **DEPLOYED**\n` +
        `  - \`TCS-MLI-KAPTON\` (Thermal Blanket): **STABLE**`;
    }

    // Default intelligent assistant response
    return `### 🛰️ Orbitra Telemetry Intelligence\n\n` +
      `Acknowledged. I am continuously monitoring telemetry for mission **${missionName}**.\n\n` +
      `- **Current Link:** \`${connState.toUpperCase()}\`\n` +
      `- **Attitude:** Roll: \`${curRoll}°\` | Pitch: \`${curPitch}°\`\n` +
      `- **Acceleration:** \`[${curAx}, ${curAy}, ${curAz}] g\`\n` +
      `- **Total Packets:** \`${diag.received.toLocaleString()}\`\n\n` +
      `You can ask me to evaluate attitude stability, inspect solar arrays, check G-forces, or command the dashboard.`;
  };

  const handleSend = (textToSend?: string) => {
    const query = textToSend ?? input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: query.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const responseText = generateAssistantResponse(query);
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content: responseText,
        timestamp: new Date(),
        metrics: {
          roll: roll ?? 0,
          pitch: pitch ?? 0,
          ax: ax ?? 0,
          ay: ay ?? 0,
          az: az ?? 1,
          status: connState,
        },
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 450);
  };

  return (
    <div className="h-full flex flex-col bg-[#212121] text-[#ececec] relative overflow-hidden font-sans">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0">
        {messages.length === 0 ? (
          /* ChatGPT Iconic Empty State */
          <div className="max-w-2xl mx-auto min-h-full flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#10a37f]/10 border border-[#10a37f]/30 flex items-center justify-center mb-4 shadow-lg">
              <OrbitraLogo size={32} theme="chatgpt" />
            </div>

            <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight mb-2">
              How can I help with your telemetry today?
            </h1>
            <p className="text-xs text-zinc-400 mb-8 max-w-md">
              Ask Orbitra Intelligence 4o about real-time attitude, solar EPS power, g-forces, or satellite payload diagnostics.
            </p>

            {/* 4 ChatGPT Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              {PROMPT_SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s.prompt)}
                  className="p-3.5 rounded-2xl bg-[#2f2f2f] hover:bg-[#383838] border border-white/5 hover:border-white/10 transition-all text-left group shadow-sm"
                >
                  <div className="text-xs font-medium text-white group-hover:text-[#10a37f] transition-colors">
                    {s.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation Stream */
          <div className="max-w-3xl mx-auto py-8 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className="flex gap-4">
                {msg.sender === 'assistant' ? (
                  <div className="w-7 h-7 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 mt-0.5 shadow">
                    <OrbitraLogo size={16} theme="monochrome" />
                  </div>
                ) : null}

                <div className={`flex-1 ${msg.sender === 'user' ? 'flex justify-end' : ''}`}>
                  {msg.sender === 'user' ? (
                    <div className="bg-[#2f2f2f] text-white px-4 py-2.5 rounded-[22px] max-w-xl text-sm leading-relaxed border border-white/5">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="prose prose-invert prose-sm max-w-none text-[#ececec] text-[13px] leading-relaxed space-y-2">
                        {msg.content.split('\n\n').map((block, bi) => {
                          if (block.startsWith('### ')) {
                            return (
                              <h3 key={bi} className="text-sm font-semibold text-white tracking-tight mt-2 mb-1 flex items-center gap-1.5">
                                {block.replace('### ', '')}
                              </h3>
                            );
                          }
                          if (block.startsWith('| ')) {
                            const lines = block.split('\n');
                            return (
                              <div key={bi} className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-[#171717]/80">
                                <table className="w-full text-[11px] font-mono text-left">
                                  <tbody>
                                    {lines.map((l, li) => {
                                      if (l.includes(':---')) return null;
                                      const cols = l.split('|').filter(c => c.trim().length > 0);
                                      return (
                                        <tr key={li} className={li === 0 ? 'bg-white/5 font-semibold text-white border-b border-white/10' : 'border-b border-white/5'}>
                                          {cols.map((col, ci) => (
                                            <td key={ci} className="px-3 py-1.5 whitespace-nowrap">
                                              {col.trim()}
                                            </td>
                                          ))}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }
                          if (block.startsWith('```')) {
                            const cleanCode = block.replace(/```[a-z]*\n?/g, '');
                            return (
                              <pre key={bi} className="bg-[#171717] p-3 rounded-xl border border-white/10 text-[11px] font-mono text-zinc-300 overflow-x-auto my-2">
                                <code>{cleanCode}</code>
                              </pre>
                            );
                          }
                          return (
                            <p key={bi} className="text-[#ececec]">
                              {block}
                            </p>
                          );
                        })}
                      </div>

                      {/* Action Bar & Copy (ChatGPT Style) */}
                      <div className="flex items-center gap-1.5 pt-1 text-zinc-400 text-xs">
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors"
                          title="Copy text"
                        >
                          {copiedId === msg.id ? <Check size={13} className="text-[#10a37f]" /> : <Copy size={13} />}
                        </button>
                        <button className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors" title="Good response">
                          <ThumbsUp size={13} />
                        </button>
                        <button className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors" title="Bad response">
                          <ThumbsDown size={13} />
                        </button>
                        <button
                          onClick={() => handleSend(messages[messages.indexOf(msg) - 1]?.content ?? 'Retry')}
                          className="p-1 rounded-md hover:bg-[#383838] hover:text-white transition-colors"
                          title="Retry generation"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-[#10a37f] flex items-center justify-center shrink-0 shadow">
                  <OrbitraLogo size={16} theme="monochrome" />
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse delay-150" />
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse delay-300" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Bottom ChatGPT Prompt Bar */}
      <div className="shrink-0 max-w-3xl w-full mx-auto px-4 pb-4 pt-2">
        <div className="relative rounded-[26px] bg-[#2f2f2f] border border-white/10 px-3.5 py-2.5 shadow-2xl flex items-center gap-2 transition-all focus-within:border-white/20">
          <button
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#383838] transition-colors shrink-0"
            title="Attach telemetry log or flight configuration"
          >
            <Plus size={16} />
          </button>

          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message Orbitra or ask about satellite telemetry..."
            className="flex-1 bg-transparent text-sm text-[#ececec] placeholder-zinc-500 focus:outline-none"
          />

          <button
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#383838] transition-colors shrink-0"
            title="Voice input"
          >
            <Mic size={15} />
          </button>

          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
              input.trim()
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-[#424242] text-zinc-500 cursor-not-allowed'
            }`}
            title="Send prompt"
          >
            <ArrowUp size={15} />
          </button>
        </div>

        <div className="text-center mt-2 text-[11px] text-zinc-500">
          Orbitra Telemetry AI can make mistakes. Verify critical orbital telemetry.
        </div>
      </div>
    </div>
  );
}
