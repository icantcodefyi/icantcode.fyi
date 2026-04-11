import { handle } from "hono/vercel";
// biome-ignore lint/suspicious/noTsIgnore: Vercel's tsc resolves this cleanly so @ts-expect-error would be flagged as unused
// @ts-ignore Vercel's tsc resolves this cleanly so @ts-expect-error would be flagged as unused
import app from "../dist/index.mjs";

export default handle(app);
