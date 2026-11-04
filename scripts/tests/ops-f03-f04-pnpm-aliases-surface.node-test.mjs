import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root exposes F03/F04 evidence verify aliases without closing live gates", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(
    pkg.scripts["observability:live-drill:verify"],
    "node scripts/check-observability-live-drill-evidence.mjs",
  );
  assert.equal(
    pkg.scripts["recovery:acceptance:verify"],
    "node scripts/check-production-recovery-acceptance-evidence.mjs",
  );

  const operations = read("docs/OPERATIONS.md");
  assert.match(operations, /pnpm observability:live-drill:verify/u);
  assert.match(operations, /pnpm recovery:acceptance:verify/u);
  assert.match(operations, /node scripts\/check-observability-live-drill-evidence\.mjs/u);
  assert.match(operations, /node scripts\/check-production-recovery-acceptance-evidence\.mjs/u);
});
