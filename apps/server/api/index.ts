import { handle } from "hono/vercel";
// @ts-ignore -- built by tsdown before the function is bundled; see vercel.json includeFiles
import app from "../dist/index.mjs";

export default handle(app);
