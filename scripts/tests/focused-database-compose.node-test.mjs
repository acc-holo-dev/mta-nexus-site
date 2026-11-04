import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("focused database cleanup removes only a database created by this invocation", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-focus-compose-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const docker = join(directory, "docker");
  const log = join(directory, "calls");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FOCUS_TEST_LOG"
case "$*" in
  *'ps postgres --format'*) echo healthy ;;
  *'CREATE DATABASE'*) [[ "$FOCUS_TEST_CREATE_FAIL" != 1 ]] || exit 1 ;;
  *'pnpm db:migrate'*) [[ "$FOCUS_TEST_MIGRATE_FAIL" != 1 ]] || exit 1 ;;
esac
`,
  );
  chmodSync(docker, 0o755);

  for (const scenario of ["create-fails", "migration-fails", "success"]) {
    writeFileSync(log, "");
    const result = spawnSync(
      "bash",
      ["scripts/run-focused-database-test-compose.sh", "tests/auth-security.test.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          FOCUS_TEST_LOG: log,
          FOCUS_TEST_CREATE_FAIL: scenario === "create-fails" ? "1" : "0",
          FOCUS_TEST_MIGRATE_FAIL: scenario === "migration-fails" ? "1" : "0",
        },
      },
    );
    const calls = readFileSync(log, "utf8");
    assert.match(calls, /CREATE DATABASE/u);
    if (scenario === "create-fails") {
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(calls, /DROP DATABASE|pg_terminate_backend/u);
    } else {
      if (scenario === "success") assert.equal(result.status, 0, result.stderr);
      else assert.notEqual(result.status, 0);
      assert.match(calls, /DROP DATABASE/u);
      assert.match(calls, /pg_terminate_backend/u);
    }
  }
});
