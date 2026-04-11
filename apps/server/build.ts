import { mkdir, rm, writeFile } from "node:fs/promises";
import { build } from "tsdown";

// Build Output API v3 — https://vercel.com/docs/build-output-api
// We emit .vercel/output/ directly so Vercel skips @vercel/node
// auto-detection and uses our pre-bundled function as-is. This is
// the only reliable way to deploy this monorepo because workspace
// packages ship raw .ts source that Node's ESM loader can't handle.

const OUT = ".vercel/output";
const FN = `${OUT}/functions/api.func`;

await rm(OUT, { recursive: true, force: true });
await mkdir(FN, { recursive: true });

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
      routes: [{ src: "/(.*)", dest: "/api" }],
    },
    null,
    2,
  )}\n`,
);

console.log(`✓ Build Output API v3 written to ${OUT}`);
