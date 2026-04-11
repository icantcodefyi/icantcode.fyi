// Vercel serverless entrypoint.
//
// Vercel expects a function export in `api/`, not a long-running server.
// Our Hono app in `../src/index.ts` only does `export default app`, which
// works locally because Bun auto-detects `export default { fetch }` and
// starts an HTTP listener. Vercel does not — it invokes a handler per
// request, so we wrap the app with `hono/vercel`'s `handle`, which is just
// `(req) => app.fetch(req)`. Combined with the catch-all rewrite in
// `vercel.json`, every incoming path is forwarded through this function
// and routed by Hono as if it were running on Bun.
import { handle } from "hono/vercel";
import app from "../src/index";

export default handle(app);
