#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { assertDisposableTestDatabase } from "./disposable-test-database.mjs";
import { selectFocusedTests } from "./focused-test-selection.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: pnpm test:focus <test-file|node-test-file> [file ...]");
  process.exit(1);
}
let selected;
try {
  selected = selectFocusedTests(root, args);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const tooling = selected.filter((file) => file.endsWith(".node-test.mjs"));
const vitest = selected.filter((file) => !file.endsWith(".node-test.mjs"));
const projects = vitest.length
  ? (await import("./test-projects.mjs")).classifyTests(root, vitest)
  : { unit: [], database: [] };
if (projects.database.length) {
  try {
    assertDisposableTestDatabase();
  } catch (error) {
    console.error(`Database tests require a disposable test database: ${error.message}`);
    process.exit(1);
  }
}
// CI runs these projects with different application-origin environments. Keep
// every selected file in its own project, and do not give host origins to unit tests.
const unitEnv = { ...process.env };
delete unitEnv.APP_URL;
delete unitEnv.NEXT_PUBLIC_APP_URL;
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands = [
  ...[
    ["unit", projects.unit, unitEnv],
    ["database", projects.database, process.env],
  ]
    .filter(([, files]) => files.length > 0)
    .map(([project, files, env]) => [
      pnpm,
      ["exec", "vitest", "run", "--project", project, ...files],
      { ...env, NEXUS_FOCUSED_TEST_FILES: JSON.stringify(files) },
    ]),
  ...(tooling.length ? [[process.execPath, ["--test", ...tooling], process.env]] : []),
];
for (const [command, args, env] of commands) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
