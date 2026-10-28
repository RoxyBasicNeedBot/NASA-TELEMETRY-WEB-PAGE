// ─────────────────────────────────────────────────────────────────────────────
// SINGULARITY Cloudflare Worker — Telemetry Gateway & Serverless API
// ─────────────────────────────────────────────────────────────────────────────

export interface Env {
  DB?: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
}

let packetNo = 1;
let angle = 0;
const baseLat = 28.6139;
const baseLng = 77.2090;

function generateTelemetryPacket() {
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

// In-memory fallback if D1 not attached
const memoryReadings: any[] = [];
const memoryLayouts: any[] = [];

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // WebSocket Telemetry Feed (/ws or Upgrade: websocket)
    if (request.headers.get('Upgrade') === 'websocket' || url.pathname === '/ws') {
      // @ts-expect-error WebSocketPair is standard Cloudflare Workers global
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

      // @ts-expect-error accept is Cloudflare Workers specific
      server.accept();

      // Send initial packet immediately
      server.send(JSON.stringify(generateTelemetryPacket()));

      // Periodic stream interval
      let timer: any = setInterval(() => {
        try {
          server.send(JSON.stringify(generateTelemetryPacket()));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 1000);

      server.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'heartbeat' || msg.type === 'ping') {
            server.send(JSON.stringify(generateTelemetryPacket()));
          }
        } catch {
          // ignore
        }
      });

      server.addEventListener('close', () => {
        if (timer) clearInterval(timer);
      });

      return new Response(null, {
        status: 101,
        // @ts-expect-error webSocket is Cloudflare Workers response property
        webSocket: client,
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'singularity-mission-control-worker',
          version: '1.0.0',
          timestamp: Date.now(),
        }),
        {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        }
      );
    }

    // External bridge broadcast POST /api/telemetry/publish
    if (url.pathname === '/api/telemetry/publish' && request.method === 'POST') {
      return new Response(JSON.stringify({ status: 'broadcasted', timestamp: Date.now() }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Ingest telemetry POST /api/telemetry
    if (url.pathname === '/api/telemetry' && request.method === 'POST') {
      try {
        const body = (await request.json()) as any;
        const readings = body.readings || [];
        const missionId = body.missionId || 'ORBITRA';
        const deviceId = body.deviceId || 'esp8266-rx';

        if (env.DB) {
          const stmt = env.DB.prepare(
            'INSERT INTO telemetry (ts, mission_id, device_id, sensor_id, field_key, value, packet_no, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          const batch = readings.map((r: any) =>
            stmt.bind(r.timestamp, missionId, deviceId, r.sensorId, r.fieldKey, r.value, r.packetNo ?? null, r.quality || 'ok')
          );
          await env.DB.batch(batch);
        } else {
          for (const r of readings) {
            memoryReadings.push({
              ts: r.timestamp,
              mission_id: missionId,
              device_id: deviceId,
              sensor_id: r.sensorId,
              field_key: r.fieldKey,
              value: r.value,
              packet_no: r.packetNo ?? null,
              quality: r.quality || 'ok',
            });
          }
          if (memoryReadings.length > 2000) memoryReadings.splice(0, memoryReadings.length - 2000);
        }

        return new Response(JSON.stringify({ inserted: readings.length }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
    }

    // Telemetry range GET /api/telemetry/range
    if (url.pathname === '/api/telemetry/range' && request.method === 'GET') {
      const sensorId = url.searchParams.get('sensorId');
      const fieldKey = url.searchParams.get('fieldKey');
      const from = Number(url.searchParams.get('from') || Date.now() - 3600_000);
      const to = Number(url.searchParams.get('to') || Date.now());
      const limit = Math.min(Number(url.searchParams.get('limit') || 500), 5000);

      if (!sensorId || !fieldKey) {
        return new Response(JSON.stringify({ error: 'sensorId and fieldKey required' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      if (env.DB) {
        const { results } = await env.DB.prepare(
          'SELECT id, ts, sensor_id, field_key, value, packet_no, quality FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?'
        ).bind(sensorId, fieldKey, from, to, limit).all();

        const totalRes = await env.DB.prepare(
          'SELECT COUNT(*) as cnt FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ?'
        ).bind(sensorId, fieldKey, from, to).first();

        return new Response(JSON.stringify({ rows: (results || []).reverse(), total: totalRes?.cnt || 0 }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      } else {
        const filtered = memoryReadings
          .filter((r) => r.sensor_id === sensorId && r.field_key === fieldKey && r.ts >= from && r.ts <= to)
          .slice(-limit);
        return new Response(JSON.stringify({ rows: filtered, total: filtered.length }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
    }

    // Export CSV GET /api/telemetry/export
    if (url.pathname === '/api/telemetry/export' && request.method === 'GET') {
      const sensorId = url.searchParams.get('sensorId');
      const fieldKey = url.searchParams.get('fieldKey');
      const from = Number(url.searchParams.get('from') || Date.now() - 86400_000);
      const to = Number(url.searchParams.get('to') || Date.now());

      let rows: any[] = [];
      if (env.DB) {
        const res = await env.DB.prepare(
          'SELECT ts, mission_id, device_id, sensor_id, field_key, value, packet_no, quality FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC'
        ).bind(sensorId, fieldKey, from, to).all();
        rows = res.results || [];
      } else {
        rows = memoryReadings.filter((r) => r.sensor_id === sensorId && r.field_key === fieldKey && r.ts >= from && r.ts <= to);
      }

      const headers = ['timestamp_ms', 'timestamp_iso', 'mission_id', 'device_id', 'sensor_id', 'field_key', 'value', 'packet_no', 'quality'];
      const csv = [
        headers.join(','),
        ...rows.map((r: any) =>
          [
            r.ts,
            new Date(r.ts).toISOString(),
            r.mission_id,
            r.device_id,
            r.sensor_id,
            r.field_key,
            r.value,
            r.packet_no ?? '',
            r.quality,
          ].join(',')
        ),
      ].join('\n');

      return new Response(csv, {
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="orbitra_${sensorId}_${fieldKey}_${Date.now()}.csv"`,
        },
      });
    }

    // Layouts API
    if (url.pathname === '/api/layouts') {
      if (request.method === 'GET') {
        if (env.DB) {
          const { results } = await env.DB.prepare('SELECT * FROM layouts ORDER BY created_at ASC').all();
          return new Response(JSON.stringify({ layouts: results || [] }), {
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ layouts: memoryLayouts }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      if (request.method === 'POST') {
        const body = (await request.json()) as any;
        const now = Date.now();
        const dataStr = JSON.stringify(body.data);

        if (env.DB) {
          await env.DB.prepare(`
            INSERT INTO layouts (id, name, is_default, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at
          `).bind(body.id, body.name, body.is_default ? 1 : 0, dataStr, now, now).run();
        } else {
          const idx = memoryLayouts.findIndex((l) => l.id === body.id);
          const item = { id: body.id, name: body.name, is_default: body.is_default ? 1 : 0, data: dataStr, created_at: now, updated_at: now };
          if (idx >= 0) memoryLayouts[idx] = item;
          else memoryLayouts.push(item);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
    }

    // Serve compiled Frontend static assets (if bound via [assets])
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  },
};
