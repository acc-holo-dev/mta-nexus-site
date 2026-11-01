#!/usr/bin/env node
/**
 * Forward-only migration authoring gate (OPS-06 / ARC14).
 *
 * Journal SQL advances through the latest applied tags, but Drizzle meta
 * snapshots still stop at 0000/0001. A plain `drizzle-kit generate` against
 * that lag can invent spurious DDL or rewrite history. Do not run generate in
 * the main checkout against live migrations.
 *
 * Supported path: disposable checkout + `pnpm --filter @nexus/db generate:custom`
 * with NEXUS_ALLOW_DB_GENERATE=1, then hand-authored SQL + journal checks.
 * See docs/OPERATIONS.md ("Forward-only migration authoring").
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const custom = process.argv.includes("--custom");
const allow = process.env.NEXUS_ALLOW_DB_GENERATE === "1";
const allowUnsafePlain = process.env.NEXUS_ALLOW_UNSAFE_DB_GENERATE === "1";

if (!custom) {
  if (!allowUnsafePlain) {
    console.error(`Refusing plain drizzle-kit generate.

Meta snapshots lag the SQL journal (see packages/db/migrations/meta/).
Supported authoring path:
  1. Work in a disposable checkout/branch (never rewrite applied SQL/journal).
  2. NEXUS_ALLOW_DB_GENERATE=1 pnpm --filter @nexus/db generate:custom -- --name <tag>
  3. Author only the expected forward-only delta in the new empty SQL file.
  4. Update release-upgrade contract/target checks; run hosted upgrade rehearsal.

Plain generate is unsupported while snapshots lag. For a disposable experiment only:
  NEXUS_ALLOW_UNSAFE_DB_GENERATE=1 pnpm --filter @nexus/db generate
Docs: docs/OPERATIONS.md (Forward-only migration authoring) and docs/ARCHITECTURE.md.`);
    process.exit(1);
  }
} else if (!allow) {
  console.error(`Refusing generate:custom without NEXUS_ALLOW_DB_GENERATE=1.

Use a disposable checkout, then:
  NEXUS_ALLOW_DB_GENERATE=1 pnpm --filter @nexus/db generate:custom -- --name <tag>

Do not rewrite applied SQL or meta/_journal.json history. See docs/OPERATIONS.md.`);
  process.exit(1);
}

const args = ["drizzle-kit", "generate"];
if (custom) args.push("--custom");
for (const arg of process.argv.slice(2)) {
  if (arg !== "--custom") args.push(arg);
}

const result = spawnSync("pnpm", ["exec", ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
