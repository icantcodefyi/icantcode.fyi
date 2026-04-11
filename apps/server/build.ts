import { mkdir, rm } from "node:fs/promises";
import { build } from "tsdown";

// Produce a fully self-contained api/index.mjs so Vercel's @vercel/node
// just ships it verbatim — no TS compilation, no import tracing into
// src/, no workspace package resolution at runtime. Every dependency
// (workspace packages + third-party) is inlined by tsdown's noExternal.

await rm("api", { recursive: true, force: true });
await mkdir("api", { recursive: true });

await build({
  entry: { hono: "./src/handler.ts" },
  format: "esm",
  outDir: "./api",
  clean: false,
  noExternal: [/@my-better-t-app\/.*/],
  silent: true,
});

console.log("✓ api/hono.mjs ready");
