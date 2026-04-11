import { mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "tsdown";

// Build Output API v3 — https://vercel.com/docs/build-output-api
// We emit .vercel/output/ directly so Vercel skips @vercel/node
// auto-detection and uses our pre-bundled function as-is. This is
// the only reliable way to deploy this monorepo because workspace
// packages ship raw .ts source that Node's ESM loader can't handle.

const OUT = ".vercel/output";
const FN = `${OUT}/functions/api.func`;
const STATIC = `${OUT}/static`;

await rm(OUT, { recursive: true, force: true });
await mkdir(FN, { recursive: true });
await mkdir(STATIC, { recursive: true });

// Diagnostic probe — if /probe.txt serves this string, Vercel is reading
// .vercel/output/; if it 404s or 500s, Vercel never saw our Build Output.
await writeFile(
  `${STATIC}/probe.txt`,
  `build-output-api-v3 ok ${new Date().toISOString()}\n`,
);

await build({
  entry: { index: "./src/handler.ts" },
  format: "esm",
  outDir: FN,
  clean: false,
  noExternal: [/@my-better-t-app\/.*/],
  silent: true,
});

await writeFile(
  `${FN}/.vc-config.json`,
  `${JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  )}\n`,
);

await writeFile(
  `${OUT}/config.json`,
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        // Static files (like /probe.txt) win over the catch-all below.
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/api" },
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(`✓ Build Output API v3 written to ${OUT}`);
