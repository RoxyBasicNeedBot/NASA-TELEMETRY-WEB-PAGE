// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Pages Functions & Workers Shared Telemetry Simulator
// ─────────────────────────────────────────────────────────────────────────────

let packetNo = 1;
let angle = 0;
const baseLat = 28.6139;
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
  const speed = +(27500 + 100 * Math.cos(angle * 0.2)).toFixed(1);
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
