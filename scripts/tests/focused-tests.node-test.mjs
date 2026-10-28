import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const runner = resolve(import.meta.dirname, "../run-focused-tests.mjs");
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "nexus-focused-"));
  try {
    const log = join(root, "pnpm.json");
    const tooling = join(root, "tooling.ran");
    writeFileSync(join(root, "unit.test.ts"), "export {};\n");
    writeFileSync(join(root, "database.integration.test.ts"), "export {};\n");
    writeFileSync(
      join(root, "tool.node-test.mjs"),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(tooling)}, "ran");`,
    );
    writeFileSync(
      join(root, "pnpm"),
      `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify({ args: process.argv.slice(2), selection: process.env.NEXUS_FOCUSED_TEST_FILES }));
process.exit(Number(process.env.NEXUS_TEST_EXIT || 0));
`,
      { mode: 0o700 },
    );
    const runnerEnv = { ...process.env };
    for (const key of Object.keys(runnerEnv)) {
      if (key.startsWith("NODE_TEST_") || key.startsWith("NODE_CHANNEL_")) delete runnerEnv[key];
    }
    const run = (args, env = {}) =>
      spawnSync(process.execPath, [runner, ...args], {
        cwd: root,
        env: {
          ...runnerEnv,
          DATABASE_URL: "",
          NEXUS_DISPOSABLE_DATABASE: "",
          NEXUS_TEST_LOG: log,
          PATH: `${root}:${process.env.PATH}`,
          ...env,
        },
        encoding: "utf8",
      });
    callback({ root, log, tooling, run });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("focused runner dispatches only selected files to each test engine", () =>
  fixture(({ log, tooling, run }) => {
    const result = run(["unit.test.ts", "tool.node-test.mjs", "unit.test.ts"]);
    assert.equal(result.status, 0, result.stderr);
    const call = JSON.parse(readFileSync(log, "utf8"));
    assert.deepEqual(call.args, ["exec", "vitest", "run", "--project", "unit", "unit.test.ts"]);
    assert.deepEqual(JSON.parse(call.selection), ["unit.test.ts"]);
    assert.ok(existsSync(tooling));
  }));

test("focused database selection fails before running any tests without a disposable database", () =>
  fixture(({ log, tooling, run }) => {
    const result = run(["tool.node-test.mjs", "database.integration.test.ts"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /disposable test database/u);
    assert.ok(!existsSync(log) && !existsSync(tooling));
  }));

test("focused runner preserves Vitest failure and does not start the next test engine", () =>
  fixture(({ tooling, run }) => {
    const result = run(["unit.test.ts", "tool.node-test.mjs"], { NEXUS_TEST_EXIT: "6" });
    assert.equal(result.status, 6);
    assert.ok(!existsSync(tooling));
  }));

test("focused runner rejects missing and non-test files without starting tests", () =>
  fixture(({ log, tooling, run }) => {
    for (const name of ["missing.test.ts", "pnpm", "--help"]) {
      const result = run(["tool.node-test.mjs", name]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /existing test file/u);
    }
    assert.ok(!existsSync(log) && !existsSync(tooling));
  }));
