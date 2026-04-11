import { handle } from "hono/vercel";
import app from "./index";

const honoFetch = handle(app);

export default {
  async fetch(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      // Bypass Hono for root to see if the issue is Hono's routing or something lower.
      if (url.pathname === "/") {
        return Response.json({
          marker: "handler-bypass",
          url: req.url,
          pathname: url.pathname,
          method: req.method,
        });
      }
      return await honoFetch(req);
    } catch (err) {
      // Surface errors so Vercel returns them in the body instead of 500-ing opaquely.
      const e = err as Error;
      return new Response(
        `HANDLER ERROR: ${e.message}\n\n${e.stack}`,
        { status: 500, headers: { "content-type": "text/plain" } },
      );
    }
  },
};
