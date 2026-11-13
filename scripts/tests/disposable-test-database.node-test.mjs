import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertDisposableTestDatabase } from "../disposable-test-database.mjs";

const runner = fileURLToPath(new URL("../run-ci-aligned-vitest.mjs", import.meta.url));
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const base = {
  DATABASE_URL: "postgres://nexus:fake@localhost:5432/mta_nexus_test",
  NEXUS_DISPOSABLE_DATABASE: "1",
};

test("accepts explicitly acknowledged disposable CI, compose and isolated database names", () => {
  for (const url of [
    base.DATABASE_URL,
    "postgres://nexus:fake@postgres:5432/mta_nexus_verify",
    `postgresql://nexus:fake@postgres:5432/nexus_test_${"a".repeat(32)}`,
    "postgres://nexus:fake@postgres:5432/nexus_focus_1790000000_1234",
    "postgres://nexus:fake@[::1]:5432/project_test",
  ]) {
    assert.doesNotThrow(() => assertDisposableTestDatabase({ ...base, DATABASE_URL: url }));
  }
});

test("refuses missing acknowledgement, nonlocal or ambiguous targets without leaking URLs", () => {
  for (const env of [
    { ...base, NEXUS_DISPOSABLE_DATABASE: undefined },
    { ...base, DATABASE_URL: undefined },
    { ...base, DATABASE_URL: "postgres://user:secret@remote.invalid/production_test" },
    { ...base, DATABASE_URL: "postgres://user:secret@localhost/production" },
    {
      ...base,
      DATABASE_URL: "postgres://user:secret@localhost/production_test?host=remote.invalid",
    },
    { ...base, DATABASE_URL: "postgres://user:secret@localhost/production_test#fragment" },
    { ...base, DATABASE_URL: "https://user:secret@localhost/project_test" },
    { ...base, DATABASE_URL: "postgres://localhost/project_test" },
  ]) {
    assert.throws(
      () => assertDisposableTestDatabase(env),
      (error) => {
        assert.doesNotMatch(error.message, /secret|remote\.invalid/u);
        return true;
      },
    );
  }
});

test("CI-aligned runner fails before spawning pnpm for an unacknowledged or unsafe target", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-disposable-runner-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "calls");
  writeFileSync(
    join(directory, "pnpm"),
    `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nappendFileSync(process.env.TEST_RUNNER_LOG, JSON.stringify({ args: process.argv.slice(2), appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null }) + "\\n");\n`,
    { mode: 0o700 },
  );
  const env = {
    ...process.env,
    ...base,
    PATH: `${directory}:${process.env.PATH}`,
    TEST_RUNNER_LOG: log,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };
  for (const bad of [
    { NEXUS_DISPOSABLE_DATABASE: "" },
    { DATABASE_URL: "postgres://user:secret@remote.invalid/production_test" },
    { DATABASE_URL: "postgres://user:secret@localhost/production" },
  ]) {
    const result = spawnSync(process.execPath, [runner], {
      encoding: "utf8",
      env: { ...env, ...bad },
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /secret|remote\.invalid/u);
    assert.equal(existsSync(log), false);
  }
  const result = spawnSync(process.execPath, [runner], { encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(calls, [
    { args: ["test:unit"], appUrl: null },
    { args: ["test:database"], appUrl: "http://localhost:3000" },
  ]);
});

test("release evidence blocks migrations and DB tests before launching commands for unsafe targets", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-release-disposable-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of [
    "scripts/release-evidence.mjs",
    "scripts/release-evidence-lib.mjs",
    "scripts/disposable-test-database.mjs",
    "scripts/toolchain-policy.mjs",
    "scripts/infra-image-policy.mjs",
    "site/packages/db/scripts/release-upgrade-contract.mjs",
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(projectRoot, file), join(root, file));
  }
  mkdirSync(join(root, "site/packages/db/migrations"), { recursive: true });
  writeFileSync(join(root, "site/packages/db/migrations/0001.sql"), "select 1;\n");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "1",
      packageManager: "pnpm@12.4.2",
      engines: { node: ">=26 <27" },
    }),
  );
  writeFileSync(join(root, ".nvmrc"), `${process.versions.node}\n`);
  writeFileSync(join(root, ".node-version"), `${process.versions.node}\n`);
  writeFileSync(join(root, "pnpm-lock.yaml"), "fixture\n");
  const bin = join(root, "bin");
  mkdirSync(bin);
  const log = join(root, "calls");
  const fake = `#!${process.execPath}
import { appendFileSync } from "node:fs";
import { basename } from "node:path";
const name = basename(process.argv[1]), args = process.argv.slice(2);
appendFileSync(process.env.TEST_RUNNER_LOG, JSON.stringify([name, ...args]) + "\\n");
if (name === "pnpm" && args[0] === "--version") console.log("12.4.2");
if (name === "git" && args[0] === "rev-parse") console.log(args.includes("--abbrev-ref") ? "main" : "a".repeat(40));
if (name === "git" && args[0] === "--version") console.log("git version 2.0");
`;
  for (const command of ["pnpm", "git", "node"])
    writeFileSync(join(bin, command), fake, { mode: 0o700 });
  const env = { ...process.env, ...base, PATH: `${bin}:${process.env.PATH}`, TEST_RUNNER_LOG: log };
  delete env.GITHUB_SHA;
  for (const [overrides, expected] of [
    [{ DATABASE_URL: "postgres://user:danger-pass-512@remote.invalid/production_test" }, "blocked"],
    [{ NEXUS_DISPOSABLE_DATABASE: "" }, "blocked"],
    [{}, "passed"],
  ]) {
    writeFileSync(log, "");
    const result = spawnSync(process.execPath, [join(root, "scripts/release-evidence.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, ...overrides },
    });
    assert.notEqual(result.status, null, result.stderr);
    const report = JSON.parse(readFileSync(join(root, "artifacts/release-evidence.json"), "utf8"));
    for (const name of ["database_migrations", "tests"]) {
      assert.equal(report.gates.find((gate) => gate.name === name)?.status, expected, name);
    }
    const calls = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      calls.some((args) => args[0] === "pnpm" && args[1] === "db:migrate"),
      expected === "passed",
    );
    assert.equal(
      calls.some((args) => args[0] === "node" && args[1] === "scripts/run-ci-aligned-vitest.mjs"),
      expected === "passed",
    );
    assert.doesNotMatch(JSON.stringify(report), /danger-pass-512|remote\.invalid/u);
  }
});
