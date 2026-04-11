import { handle } from "hono/vercel";
import app from "./index";

// Vercel's Node.js runtime dispatches via `defaultExport.fetch(request)` —
// it needs an object with a fetch method, not a bare function. handle(app)
// returns (req) => app.fetch(req), which we wrap into the expected shape.
export default {
  fetch: handle(app),
};
