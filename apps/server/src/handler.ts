// TEMPORARY DIAGNOSTIC — plain fetch handler, no Hono, no DB, no imports.
// If this 200s on Vercel we know the routing + .mjs pipeline is fine and
// the crash is inside the Hono app bundle. If this also 500s, Vercel is
// failing at a level below our code (runtime/launcher/module load).
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    return new Response(
      `marker-xyz789 ok path=${url.pathname} ts=${new Date().toISOString()}`,
      { status: 200, headers: { "content-type": "text/plain" } },
    );
  },
};
