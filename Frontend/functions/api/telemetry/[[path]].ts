interface Reading {
  id?: number;
  ts: number;
  missionId: string;
  deviceId: string;
  sensorId: string;
  fieldKey: string;
  value: number;
  packetNo: number | null;
  quality: string;
}

// In-memory buffer fallback when Cloudflare D1 is not attached
declare global {
  // eslint-disable-next-line no-var
  var __telemetry_store: Reading[] | undefined;
}

function getMemoryStore(): Reading[] {
  if (!globalThis.__telemetry_store) {
    globalThis.__telemetry_store = [];
  }
  return globalThis.__telemetry_store;
}

export const onRequest: PagesFunction<{ DB?: { prepare: (sql: string) => any } }> = async (context) => {
  const url = new URL(context.request.url);
  const pathParts = (context.params['path'] as string[] | undefined) || [];
  const subRoute = pathParts.join('/');
  const method = context.request.method;

  // 1. POST /api/telemetry/publish (broadcast from external bridge)
  if (method === 'POST' && subRoute === 'publish') {
    return new Response(JSON.stringify({ status: 'broadcasted', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. POST /api/telemetry (ingest readings)
  if (method === 'POST' && subRoute === '') {
    try {
      const body = await context.request.json() as {
        missionId?: string;
        deviceId?: string;
        readings?: Array<{
          timestamp: number;
          sensorId: string;
          fieldKey: string;
          value: number;
          packetNo?: number | null;
          quality?: string;
        }>;
      };

      const missionId = body.missionId || 'ORBITRA';
      const deviceId = body.deviceId || 'esp8266-rx';
      const readings = body.readings || [];

      if (context.env.DB) {
        // Cloudflare D1 storage
        const stmt = context.env.DB.prepare(
          'INSERT INTO telemetry (ts, mission_id, device_id, sensor_id, field_key, value, packet_no, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const batch = readings.map((r) =>
          stmt.bind(r.timestamp, missionId, deviceId, r.sensorId, r.fieldKey, r.value, r.packetNo ?? null, r.quality || 'ok')
        );
        // @ts-expect-error batch is D1 method
        await context.env.DB.batch(batch);
      } else {
        // Fallback in-memory
        const store = getMemoryStore();
        for (const r of readings) {
          store.push({
            id: store.length + 1,
            ts: r.timestamp,
            missionId,
            deviceId,
            sensorId: r.sensorId,
            fieldKey: r.fieldKey,
            value: r.value,
            packetNo: r.packetNo ?? null,
            quality: r.quality || 'ok',
          });
        }
        if (store.length > 2000) {
          store.splice(0, store.length - 2000);
        }
      }

      return new Response(JSON.stringify({ inserted: readings.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 3. GET /api/telemetry/latest
  if (method === 'GET' && subRoute === 'latest') {
    const sensorId = url.searchParams.get('sensorId');
    const fieldKey = url.searchParams.get('fieldKey');
    if (!sensorId || !fieldKey) {
      return new Response(JSON.stringify({ error: 'sensorId and fieldKey required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (context.env.DB) {
      const row = await context.env.DB.prepare(
        'SELECT * FROM telemetry WHERE sensor_id = ? AND field_key = ? ORDER BY ts DESC LIMIT 1'
      ).bind(sensorId, fieldKey).first();
      return new Response(JSON.stringify({ row: row || null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const store = getMemoryStore();
      const row = [...store].reverse().find((r) => r.sensorId === sensorId && r.fieldKey === fieldKey);
      return new Response(JSON.stringify({ row: row || null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 4. GET /api/telemetry/range
  if (method === 'GET' && subRoute === 'range') {
    const sensorId = url.searchParams.get('sensorId');
    const fieldKey = url.searchParams.get('fieldKey');
    const from = Number(url.searchParams.get('from') || Date.now() - 3600_000);
    const to = Number(url.searchParams.get('to') || Date.now());
    const limit = Math.min(Number(url.searchParams.get('limit') || 500), 5000);

    if (!sensorId || !fieldKey) {
      return new Response(JSON.stringify({ error: 'sensorId and fieldKey required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (context.env.DB) {
      const { results: rows } = await context.env.DB.prepare(
        'SELECT id, ts, sensor_id, field_key, value, packet_no, quality FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?'
      ).bind(sensorId, fieldKey, from, to, limit).all();

      const totalResult = await context.env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ?'
      ).bind(sensorId, fieldKey, from, to).first();

      return new Response(JSON.stringify({ rows: (rows || []).reverse(), total: totalResult?.cnt || 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const store = getMemoryStore();
      const filtered = store
        .filter((r) => r.sensorId === sensorId && r.fieldKey === fieldKey && r.ts >= from && r.ts <= to)
        .slice(-limit);

      return new Response(JSON.stringify({ rows: filtered, total: filtered.length }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 5. GET /api/telemetry/export (CSV)
  if (method === 'GET' && subRoute === 'export') {
    const sensorId = url.searchParams.get('sensorId');
    const fieldKey = url.searchParams.get('fieldKey');
    const from = Number(url.searchParams.get('from') || Date.now() - 86400_000);
    const to = Number(url.searchParams.get('to') || Date.now());

    let rows: Reading[] = [];
    if (context.env.DB) {
      const res = await context.env.DB.prepare(
        'SELECT ts, mission_id, device_id, sensor_id, field_key, value, packet_no, quality FROM telemetry WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ? ORDER BY ts ASC'
      ).bind(sensorId, fieldKey, from, to).all();
      rows = (res.results as any[]) || [];
    } else {
      rows = getMemoryStore().filter((r) => r.sensorId === sensorId && r.fieldKey === fieldKey && r.ts >= from && r.ts <= to);
    }

    const headers = ['timestamp_ms', 'timestamp_iso', 'mission_id', 'device_id', 'sensor_id', 'field_key', 'value', 'packet_no', 'quality'];
    const csv = [
      headers.join(','),
      ...rows.map((r: any) =>
        [
          r.ts,
          new Date(r.ts).toISOString(),
          r.mission_id || r.missionId,
          r.device_id || r.deviceId,
          r.sensor_id || r.sensorId,
          r.field_key || r.fieldKey,
          r.value,
          r.packet_no || r.packetNo || '',
          r.quality,
        ].join(',')
      ),
    ].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vyomaastra_${sensorId}_${fieldKey}_${Date.now()}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
};
