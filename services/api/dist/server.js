"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_1 = require("./node");
const port = Number(process.env.PORT || 4100);
const server = (0, node_http_1.createServer)(node_1.nodeHandler);
server.listen(port, () => console.log(`smart-container-api listening on :${port}`));
for (const sig of ["SIGINT", "SIGTERM"])
    process.on(sig, () => server.close(() => process.exit(0)));
