// Fails when a test has no bank entry, a bank entry has no test, or an e2e test carries the wrong tags.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const bank = JSON.parse(readFileSync("tests/bank.json", "utf8"));
const byId = new Map(bank.map((b) => [b.id, b]));
function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
}
const files = ["tests", "packages/domain/tests", "services/api/tests", "web/tests"].flatMap((d) => walk(d)).filter((f) => !f.endsWith("helpers.ts"));
const found = new Map();
const problems = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const re = /(?:test|it)\(\s*(["'`])(TC-[USEA]-\d{3})([^\n]*?)\1\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    const [, , id, rest] = m;
    if (!byId.has(id)) problems.push(`${f}: ${id} is not in tests/bank.json`);
    if (found.has(id)) problems.push(`${id} is used twice (${found.get(id)} and ${f})`);
    found.set(id, f);
    const b = byId.get(id);
    if (b && b.type === "e2e") {
      if (!rest.includes(`@${b.suite}`)) problems.push(`${id} should carry @${b.suite}`);
      if (["ui", "ux", "a11y"].includes(b.category) && !rest.includes(`@${b.category}`)) problems.push(`${id} should carry @${b.category}`);
    }
  }
}
for (const b of bank) if (!found.has(b.id)) problems.push(`${b.id} has no automated test`);
if (problems.length) { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`Test bank OK: ${bank.length} cases, all automated.`);
