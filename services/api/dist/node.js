"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeHandler = nodeHandler;
const handlers_1 = require("./handlers");
/** Adapter from Node's http types to the framework-free handler. Used by Vercel functions and by server.ts. */
function nodeHandler(req, res) {
    try {
        const url = new URL(req.url ?? "/", "http://localhost");
        const r = (0, handlers_1.handle)({ method: (req.method ?? "GET").toUpperCase(), path: url.pathname, query: url.searchParams });
        for (const [k, v] of Object.entries(r.headers))
            res.setHeader(k, v);
        res.statusCode = r.status;
        if (r.body === null || req.method === "HEAD") {
            res.end();
            return;
        }
        res.end(JSON.stringify(r.body));
    }
    catch (e) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: { code: "internal_error", message: "Unexpected error." } }));
        console.error(e);
    }
}
exports.default = nodeHandler;
