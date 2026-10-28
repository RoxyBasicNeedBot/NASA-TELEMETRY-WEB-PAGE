interface LayoutRecord {
  id: string;
  name: string;
  is_default: number;
  data: string;
  created_at: number;
  updated_at: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __layouts_store: LayoutRecord[] | undefined;
}

function getLayoutsStore(): LayoutRecord[] {
  if (!globalThis.__layouts_store) {
    globalThis.__layouts_store = [];
  }
  return globalThis.__layouts_store;
}

export const onRequest: PagesFunction<{ DB?: { prepare: (sql: string) => any } }> = async (context) => {
  const method = context.request.method;
  const pathParts = (context.params['path'] as string[] | undefined) || [];
  const layoutId = pathParts[0];

  // 1. GET /api/layouts
  if (method === 'GET' && !layoutId) {
    if (context.env.DB) {
      const { results } = await context.env.DB.prepare('SELECT * FROM layouts ORDER BY created_at ASC').all();
      return new Response(JSON.stringify({ layouts: results || [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ layouts: getLayoutsStore() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. POST /api/layouts
  if (method === 'POST') {
    try {
      const body = await context.request.json() as {
        id?: string;
        name?: string;
        is_default?: boolean;
        data?: unknown;
      };

      if (!body.id || !body.name || body.data === undefined) {
        return new Response(JSON.stringify({ error: 'id, name, and data are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = Date.now();
      const isDefaultNum = body.is_default ? 1 : 0;
      const dataStr = JSON.stringify(body.data);

      if (context.env.DB) {
        await context.env.DB.prepare(`
          INSERT INTO layouts (id, name, is_default, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            is_default = excluded.is_default,
            data = excluded.data,
            updated_at = excluded.updated_at
        `).bind(body.id, body.name, isDefaultNum, dataStr, now, now).run();
      } else {
        const store = getLayoutsStore();
        const existingIdx = store.findIndex((l) => l.id === body.id);
        const record: LayoutRecord = {
          id: body.id,
          name: body.name,
          is_default: isDefaultNum,
          data: dataStr,
          created_at: existingIdx >= 0 ? store[existingIdx].created_at : now,
          updated_at: now,
        };
        if (existingIdx >= 0) {
          store[existingIdx] = record;
        } else {
          store.push(record);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 3. DELETE /api/layouts/:id
  if (method === 'DELETE' && layoutId) {
    if (context.env.DB) {
      await context.env.DB.prepare('DELETE FROM layouts WHERE id = ?').bind(layoutId).run();
    } else {
      const store = getLayoutsStore();
      const idx = store.findIndex((l) => l.id === layoutId);
      if (idx >= 0) store.splice(idx, 1);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
};
