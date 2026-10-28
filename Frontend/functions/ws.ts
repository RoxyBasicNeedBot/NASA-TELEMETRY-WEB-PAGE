import { generateTelemetryPacket } from './shared';

export const onRequestGet: PagesFunction = async (context) => {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  // Cloudflare Workers Native WebSocketPair
  // @ts-expect-error WebSocketPair is a Cloudflare Workers global
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

  // @ts-expect-error accept() is Cloudflare Workers specific
  server.accept();

  // Send first packet immediately on connect
  server.send(JSON.stringify(generateTelemetryPacket()));

  let intervalId: ReturnType<typeof setInterval> | null = null;
  intervalId = setInterval(() => {
    try {
      server.send(JSON.stringify(generateTelemetryPacket()));
    } catch {
      if (intervalId) clearInterval(intervalId);
    }
  }, 1000);

  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data as string);
      // If client sends heartbeat or request, reply with fresh telemetry packet
      if (data.type === 'heartbeat' || data.type === 'ping' || data.action === 'telemetry') {
        server.send(JSON.stringify(generateTelemetryPacket()));
      }
    } catch {
      // ignore
    }
  });

  server.addEventListener('close', () => {
    if (intervalId) clearInterval(intervalId);
  });

  server.addEventListener('error', () => {
    if (intervalId) clearInterval(intervalId);
  });

  return new Response(null, {
    status: 101,
    // @ts-expect-error webSocket response option is Cloudflare Workers specific
    webSocket: client,
  });
};
