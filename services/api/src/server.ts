import { createServer } from "node:http";
import { nodeHandler } from "./node";

const port = Number(process.env.PORT || 4100);
const server = createServer(nodeHandler);
server.listen(port, () => console.log(`smart-container-api listening on :${port}`));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => server.close(() => process.exit(0)));
