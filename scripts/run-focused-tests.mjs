#!/usr/bin/env node
import { existsSync, realpathSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { classifyTests } from "./test-projects.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: pnpm test:focus <test-file> [test-file ...]");
  process.exit(1);
}
const files = [];
for (const arg of args) {
  const absolute = resolve(root, arg);
  if (
    arg.startsWith("-") ||
    !/\.(test|spec)\.[cm]?[jt]sx?$/u.test(arg) ||
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
const projects = classifyTests(root, selected);
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
const result = spawnSync("pnpm", ["exec", "vitest", "run", ...flags, ...selected], {
  cwd: root,
  env: { ...process.env, NEXUS_FOCUSED_TEST_FILES: JSON.stringify(selected) },
  stdio: "inherit",
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
