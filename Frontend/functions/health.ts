export const onRequestGet: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'singularity-mission-control-cloudflare-pages',
      version: '1.0.0',
      timestamp: Date.now(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};
