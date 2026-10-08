import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// These fixtures consume rendered Compose JSON and are not standalone tests.
const fixtures = new Set(["mail-worker-compose.node-test.mjs", "recovery-compose.node-test.mjs"]);

export function discoverToolingTests(directories = ["scripts/tests", "packages/db/scripts"], { root = process.cwd() } = {}) {
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith(".node-test.mjs") && !fixtures.has(entry.name)) files.push(path);
    }
  };
  for (const directory of directories) walk(directory);
  return files.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = discoverToolingTests();
  if (!files.length) {
    console.error("No tooling tests discovered; refusing to report success.");
    process.exitCode = 1;
  } else {
    const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  }
}
