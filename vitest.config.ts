import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // "@" points at the web app, only used by the translation tests.
  resolve: { alias: { "@": fileURLToPath(new URL("./web", import.meta.url)) } },
  test: {
    include: ["packages/domain/tests/**/*.test.ts", "services/api/tests/**/*.test.ts", "web/tests/**/*.test.ts"],
    environment: "node",
  },
});
