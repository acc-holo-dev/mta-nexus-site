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
  'context show') echo default ;;
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
      ["scripts/run-focused-database-test-compose.sh", "tests/database/password-change-transaction.test.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          COMPOSE_PROJECT_NAME: "nexus-local",
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

test("focused database cleanup verifies removal and preserves an earlier failure", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-focus-cleanup-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const docker = join(directory, "docker");
  const log = join(directory, "calls");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FOCUS_TEST_LOG"
case "$*" in
  'context show') echo default ;;
  *'ps postgres --format'*) echo healthy ;;
  *'pnpm test:focus'*) [[ "$FOCUS_TEST_SCENARIO" != test-and-drop-fail ]] || exit 42 ;;
  *'DROP DATABASE'*) [[ "$FOCUS_TEST_SCENARIO" != drop-fail && "$FOCUS_TEST_SCENARIO" != test-and-drop-fail ]] || exit 55 ;;
  *'SELECT 1 FROM pg_database'*)
    [[ "$FOCUS_TEST_SCENARIO" != verify-fail ]] || exit 56
    if [[ "$FOCUS_TEST_SCENARIO" == remaining ]]; then echo 1; fi ;;
esac
exit 0
`,
  );
  chmodSync(docker, 0o755);
  for (const scenario of [
    "success",
    "drop-fail",
    "verify-fail",
    "remaining",
    "test-and-drop-fail",
  ]) {
    writeFileSync(log, "");
    const result = spawnSync(
      "bash",
      ["scripts/run-focused-database-test-compose.sh", "tests/database/password-change-transaction.test.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          COMPOSE_PROJECT_NAME: "nexus-local",
          PATH: `${directory}:${process.env.PATH}`,
          FOCUS_TEST_LOG: log,
          FOCUS_TEST_SCENARIO: scenario,
        },
      },
    );
    const calls = readFileSync(log, "utf8");
    assert.match(calls, /DROP DATABASE/u);
    assert.match(calls, /SELECT 1 FROM pg_database/u);
    if (scenario === "success") assert.equal(result.status, 0, result.stderr);
    else {
      assert.notEqual(result.status, 0, scenario);
      assert.match(result.stderr, /owned test database/iu);
    }
    if (scenario === "test-and-drop-fail") assert.equal(result.status, 42);
  }
});

test("focused Compose refuses remote daemons and non-local projects before mutation", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-focus-local-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const docker = join(directory, "docker");
  const log = join(directory, "calls");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FOCUS_TEST_LOG"
case "$*" in
  'context show')
    if [[ "$FOCUS_TEST_CONTEXT" == error ]]; then echo default; exit 50; fi
    echo "$FOCUS_TEST_CONTEXT" ;;
  *'ps postgres --format'*) echo healthy ;;
esac
exit 0
`,
  );
  chmodSync(docker, 0o755);
  for (const [scenario, overrides] of [
    ["remote-host", { DOCKER_HOST: "tcp://remote.invalid:2375" }],
    ["explicit-context", { DOCKER_CONTEXT: "default" }],
    ["non-local-project", { COMPOSE_PROJECT_NAME: "nexus-production" }],
    ["other-context", { FOCUS_TEST_CONTEXT: "remote" }],
    ["context-error", { FOCUS_TEST_CONTEXT: "error" }],
    ["local", {}],
  ]) {
    writeFileSync(log, "");
    const result = spawnSync(
      "bash",
      ["scripts/run-focused-database-test-compose.sh", "tests/database/password-change-transaction.test.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          COMPOSE_PROJECT_NAME: "nexus-local",
          FOCUS_TEST_CONTEXT: "default",
          FOCUS_TEST_LOG: log,
          ...overrides,
        },
      },
    );
    const calls = readFileSync(log, "utf8");
    if (scenario === "local") {
      assert.equal(result.status, 0, result.stderr);
      assert.match(calls, /compose -p nexus-local .*up -d postgres/u);
    } else {
      assert.notEqual(result.status, 0, scenario);
      assert.match(result.stderr, /Refusing focused database tests/u);
      assert.doesNotMatch(calls, /compose .* (?:up|exec|run)/u);
    }
  }
});
