import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Accepts either a single URL or a comma-separated list of URLs.
 * Returns a normalised `string[]` so Hono's `cors({ origin })`
 * (which accepts `string | string[]`) gets the full allowlist.
 */
const corsOriginSchema = z
  .string()
  .min(1)
  .transform((raw) =>
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()).min(1));

/**
 * `clientPrefix: ""` + empty `client: {}` narrows @t3-oss/env-core's
 * internal `TPrefix` generic to the literal `""`. Without it, some build
 * environments (notably Vercel's tsc run) fail to narrow `TPrefix` at all
 * and widen it to `string`, which makes every server key trip the
 * "should not be prefixed with ${string}" guard in `ServerOptions`.
 *
 * See env-core's `ServerOptions` type:
 *   TPrefix extends "" ? TServer[TKey] : ... ErrorMessage<...>
 * An explicit empty prefix always takes the first branch.
 */
export const env = createEnv({
  clientPrefix: "",
  client: {},
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: corsOriginSchema,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SPOTIFY_CLIENT_ID: z.string().optional(),
    SPOTIFY_CLIENT_SECRET: z.string().optional(),
    SPOTIFY_REFRESH_TOKEN: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
