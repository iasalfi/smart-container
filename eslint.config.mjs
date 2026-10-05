import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: ["out/**", ".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "**/geo-data.ts", "services/api/dist/**", "web/out/**", "web/.next/**"] },
  { settings: { next: { rootDir: "web/" } } },
  { rules: { "react-hooks/set-state-in-effect": "off", "@next/next/no-html-link-for-pages": "off" } },
];
export default config;
