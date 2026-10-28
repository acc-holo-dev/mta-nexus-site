#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: pnpm test:focus <test-file|node-test-file> [file ...]");
  process.exit(1);
}
const files = [];
for (const arg of args) {
  const absolute = resolve(root, arg);
  if (
    arg.startsWith("-") ||
    !/(?:\.(test|spec)\.[cm]?[jt]sx?|\.node-test\.mjs)$/u.test(arg) ||
    !existsSync(absolute) ||
    !statSync(absolute).isFile() ||
    !realpathSync(absolute).startsWith(`${realpathSync(root)}${sep}`)
  ) {
    console.error(`Expected an existing test file inside the repository: ${arg}`);
    process.exit(1);
  }
  files.push(relative(root, absolute).split(sep).join("/"));
}
const selected = [...new Set(files)];
const tooling = selected.filter((file) => file.endsWith(".node-test.mjs"));
const vitest = selected.filter((file) => !file.endsWith(".node-test.mjs"));
const projects = vitest.length
  ? (await import("./test-projects.mjs")).classifyTests(root, vitest)
  : { unit: [], database: [] };
if (
  projects.database.length &&
  (!process.env.DATABASE_URL || process.env.NEXUS_DISPOSABLE_DATABASE !== "1")
) {
  console.error(
    "Database tests require DATABASE_URL and NEXUS_DISPOSABLE_DATABASE=1 for a disposable test database.",
  );
  process.exit(1);
}
const flags = [
  ...(projects.unit.length ? ["--project", "unit"] : []),
  ...(projects.database.length ? ["--project", "database"] : []),
];
const commands = [
  ...(vitest.length
    ? [
        [
          "pnpm",
          ["exec", "vitest", "run", ...flags, ...vitest],
          { ...process.env, NEXUS_FOCUSED_TEST_FILES: JSON.stringify(vitest) },
        ],
      ]
    : []),
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
