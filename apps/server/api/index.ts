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
//
// We import from `../dist/index.mjs` (the pre-built tsdown bundle) rather
// than `../src/index` because Vercel's Node builder file-traces imports
// instead of bundling them. A raw `../src/index` import leaves Node ESM
// unable to resolve the extension-less path at runtime, and even if it
// could, the workspace `@my-better-t-app/*` packages export raw `.ts`
// files that Node cannot load. `tsdown` already bundles all of that
// (`noExternal: [/@my-better-t-app\/.*/]`) into a single self-contained
// `.mjs` module, so pointing at `dist/` sidesteps the whole resolution
// problem. The `buildCommand` in `vercel.json` runs `tsdown` before
// Vercel processes `api/`, so the file is guaranteed to exist.
import { handle } from "hono/vercel";
// @ts-expect-error — pre-built ESM bundle from tsdown; no .d.mts emitted.
import app from "../dist/index.mjs";

export default handle(app);
