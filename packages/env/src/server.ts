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

export const env = createEnv({
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
