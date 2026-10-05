// Copies the shared domain code (packages/domain/src) into a service that needs it.
// Each service stays independently buildable and deployable; the copies are generated and git-ignored.
//   node scripts/vendor-domain.mjs api   -> services/api/src/domain   (everything)
//   node scripts/vendor-domain.mjs web   -> web/lib                    (everything except the fleet generator)
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "packages/domain/src");
const targets = {
  api: { dir: join(root, "services/api/src/domain"), skip: [] },
  web: { dir: join(root, "web/lib"), skip: ["fleet.ts"] },
};
const which = process.argv[2];
if (!targets[which]) { console.error("usage: vendor-domain.mjs api|web"); process.exit(1); }
const { dir, skip } = targets[which];
mkdirSync(dir, { recursive: true });
let n = 0;
for (const f of readdirSync(src)) {
  if (skip.includes(f)) continue;
  cpSync(join(src, f), join(dir, f));
  n++;
}
// remove stale copies of skipped files
for (const f of skip) rmSync(join(dir, f), { force: true });
console.log(`vendored ${n} domain files into ${dir.replace(root + "/", "")}`);
