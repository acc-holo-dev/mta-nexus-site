import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// These two programs validate rendered Compose JSON supplied by infrastructure
// harnesses; they are not standalone node:test suites.
const fixtures = new Set(["mail-worker-compose.node-test.mjs", "recovery-compose.node-test.mjs"]);
const files = ["scripts/tests", "packages/db/scripts"].flatMap(directory =>
  readdirSync(directory).filter(name => name.endsWith(".node-test.mjs") && !fixtures.has(name))
    .map(name => join(directory, name))).sort();
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
