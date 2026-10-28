import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry Simulator & WebSocket Service
// Broadcasts simulated CubeSat telemetry packets every 1000ms, and relays
// any incoming telemetry from external ground stations to connected UI clients.
// ─────────────────────────────────────────────────────────────────────────────

let packetNo = 1;
let angle = 0;
const baseLat = 28.6139; // New Delhi / initial ground track coordinates
const baseLng = 77.2090;

export interface TelemetryPacket {
  packetNo: number;
  timestamp: number;
  temperature: number;
  humidity: number;
  ax: number;
  ay: number;
  az: number;
  totalAcc: number;
  gx: number;
  gy: number;
  gz: number;
  roll: number;
  pitch: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  satellites: number;
  gpsFix: number;
  bmpTemperature: number;
  pressure: number;
  bmpAltitude: number;
}

export function generateTelemetryPacket(): TelemetryPacket {
  angle += 0.05;
  packetNo++;

  const temp = +(24.5 + 2.5 * Math.sin(angle * 0.8)).toFixed(2);
  const humidity = +(55 + 5 * Math.cos(angle * 0.5)).toFixed(2);

  const roll = +(15 * Math.sin(angle)).toFixed(2);
  const pitch = +(10 * Math.cos(angle * 1.2)).toFixed(2);

  const ax = +(0.05 * Math.sin(angle * 2)).toFixed(3);
  const ay = +(0.03 * Math.cos(angle * 2)).toFixed(3);
  const az = +(9.81 + 0.1 * Math.sin(angle)).toFixed(3);
  const totalAcc = +(Math.sqrt(ax * ax + ay * ay + az * az)).toFixed(3);

  const gx = +(0.2 * Math.sin(angle)).toFixed(3);
  const gy = +(0.15 * Math.cos(angle)).toFixed(3);
  const gz = +(0.08 * Math.sin(angle * 0.5)).toFixed(3);

  const altitude = +(450 + 50 * Math.sin(angle * 0.3)).toFixed(1);
  const speed = +(27500 + 100 * Math.cos(angle * 0.2)).toFixed(1); // km/h orbital speed
  const pressure = +(1013.25 - (altitude / 10)).toFixed(2);
  const bmpTemp = +(temp - 1.2).toFixed(2);
  const bmpAlt = altitude;

  const lat = +(baseLat + 0.05 * Math.sin(angle * 0.2)).toFixed(5);
  const lng = +(baseLng + 0.08 * angle).toFixed(5);

  return {
    packetNo,
    timestamp: Date.now(),
    temperature: temp,
    humidity,
    ax,
    ay,
    az,
    totalAcc,
    gx,
    gy,
    gz,
    roll,
    pitch,
    latitude: lat,
    longitude: lng,
    altitude,
    speed,
    satellites: 12,
    gpsFix: 1,
    bmpTemperature: bmpTemp,
    pressure,
    bmpAltitude: bmpAlt,
  };
}

let activeWss: WebSocketServer | null = null;

export function broadcastTelemetry(packet: unknown): void {
  if (!activeWss) return;
  const message = typeof packet === 'string' ? packet : JSON.stringify(packet);
  activeWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  activeWss = wss;

  wss.on('connection', (socket, req) => {
    const remote = req.socket.remoteAddress;
    console.log(`[WS] Telemetry client connected (${remote})`);

    // Stream initial telemetry frame immediately upon connection
    socket.send(JSON.stringify(generateTelemetryPacket()));

    socket.on('message', (data) => {
      // If an external hardware bridge sends a packet over WS, relay to all other clients
      try {
        const text = data.toString();
        const parsed = JSON.parse(text);
        const broadcastStr = JSON.stringify(parsed);
        wss.clients.forEach((c) => {
          if (c !== socket && c.readyState === WebSocket.OPEN) {
            c.send(broadcastStr);
          }
        });
      } catch {
        // Ignore non-json frames
      }
    });

    socket.on('close', () => {
      console.log(`[WS] Client disconnected (${remote})`);
    });
  });

  // Automated 1000ms periodic simulation broadcaster
  const enableSimulator = process.env['DISABLE_SIMULATOR'] !== 'true';
  if (enableSimulator) {
    console.log('[SIMULATOR] Automated CubeSat telemetry broadcast active (1000ms interval)');
    setInterval(() => {
      if (wss.clients.size > 0) {
        broadcastTelemetry(generateTelemetryPacket());
      }
    }, 1000);
  }

  return wss;
}
