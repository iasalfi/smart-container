import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "./handlers";

/** Adapter from Node's http types to the framework-free handler. Used by Vercel functions and by server.ts. */
export function nodeHandler(req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const r = handle({ method: (req.method ?? "GET").toUpperCase(), path: url.pathname, query: url.searchParams });
    for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
    res.statusCode = r.status;
    if (r.body === null || req.method === "HEAD") { res.end(); return; }
    res.end(JSON.stringify(r.body));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: { code: "internal_error", message: "Unexpected error." } }));
    console.error(e);
  }
}
export default nodeHandler;
