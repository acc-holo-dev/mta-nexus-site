import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      [
        "scripts/run-focused-database-test-compose.sh",
        "site/tests/database/password-change-transaction.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          COMPOSE_PROJECT_NAME: "nexus-local",
          PATH: `${directory}:${process.env.PATH}`,
          FOCUS_TEST_LOG: log,
          TMPDIR: directory,
          FOCUS_TEST_CREATE_FAIL: scenario === "create-fails" ? "1" : "0",
          FOCUS_TEST_MIGRATE_FAIL: scenario === "migration-fails" ? "1" : "0",
        },
      },
    );
    const calls = readFileSync(log, "utf8");
    assert.match(calls, /CREATE DATABASE/u);
    assert.equal(
      readdirSync(directory).filter((name) => name.startsWith("nexus-focus-empty.")).length,
      0,
    );
    if (scenario !== "create-fails") {
      const appRuns = calls.split("\n").filter((line) => line.includes(" run --rm "));
      assert.ok(appRuns.length >= 1);
      for (const line of appRuns) {
        assert.match(line, /-e STORAGE_LOCAL_PATH=\/tmp\/nexus-focus-uploads/u);
        assert.match(line, /nexus-focus-empty\.[^\s]+:\/data\/uploads:ro/u);
        assert.doesNotMatch(line, /STORAGE_LOCAL_PATH=\/data\/uploads/u);
        assert.match(line, /-e BUILD_SCANNER=disabled/u);
        assert.match(line, /-e EMAIL_PROVIDER=disabled/u);
        assert.match(line, /-e WEB_PUSH_VAPID_PUBLIC_KEY=(?:\s|$)/u);
        assert.match(line, /-e WEB_PUSH_VAPID_PRIVATE_KEY=(?:\s|$)/u);
        assert.match(line, /-e WEB_PUSH_VAPID_SUBJECT=(?:\s|$)/u);
      }
    }
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
      [
        "scripts/run-focused-database-test-compose.sh",
        "site/tests/database/password-change-transaction.test.ts",
      ],
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
      [
        "scripts/run-focused-database-test-compose.sh",
        "site/tests/database/password-change-transaction.test.ts",
      ],
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
      assert.match(calls, /compose -p nexus-local .*up -d --no-recreate postgres/u);
    } else {
      assert.notEqual(result.status, 0, scenario);
      assert.match(result.stderr, /Refusing focused database tests/u);
      assert.doesNotMatch(calls, /compose .* (?:up|exec|run)/u);
    }
  }
});

test("focused Compose validates every selection before invoking Docker and accepts colocated tests", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-focus-validation-"));
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
esac
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${directory}:${process.env.PATH}`,
    DOCKER_HOST: "",
    DOCKER_CONTEXT: "",
    COMPOSE_PROJECT_NAME: "nexus-local",
    FOCUS_TEST_LOG: log,
  };
  for (const args of [
    [
      "site/tests/database/password-change-transaction.test.ts",
      "site/src/features/shell/components/sidebar.tsx",
    ],
    ["site/tests/database/password-change-transaction.test.ts", "site/src/missing.test.ts"],
    ["scripts/tests/focused-tests.node-test.mjs"],
  ]) {
    writeFileSync(log, "");
    const result = spawnSync("bash", ["scripts/run-focused-database-test-compose.sh", ...args], {
      encoding: "utf8",
      env,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected an existing test file/u);
    assert.equal(readFileSync(log, "utf8"), "");
  }
  writeFileSync(log, "");
  const result = spawnSync(
    "bash",
    ["scripts/run-focused-database-test-compose.sh", "site/src/app/market/[slug]/page.test.ts"],
    {
      encoding: "utf8",
      env,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(log, "utf8");
  assert.match(calls, /CREATE DATABASE/u);
  assert.match(calls, /vitest\.config\.ts:\/app\/vitest\.config\.ts:ro/u);
  assert.ok(calls.includes("pnpm test:focus site/src/app/market/[slug]/page.test.ts"));
  assert.match(calls, /DROP DATABASE/u);
});

test("focused storage cleanup never recursively deletes unexpected contents", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-focus-mount-"));
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
  *'pnpm test:focus'*)
    for arg in "$@"; do
      case "$arg" in
        *nexus-focus-empty.*:/data/uploads:ro) touch "\${arg%:/data/uploads:ro}/unexpected" ;;
      esac
    done
    [[ "$FOCUS_TEST_FAILURE" != 1 ]] || exit 42 ;;
esac
`,
    { mode: 0o755 },
  );
  for (const failure of ["0", "1"]) {
    const result = spawnSync(
      "bash",
      [
        "scripts/run-focused-database-test-compose.sh",
        "site/tests/database/password-change-transaction.test.ts",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          TMPDIR: directory,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          COMPOSE_PROJECT_NAME: "nexus-local",
          FOCUS_TEST_LOG: log,
          FOCUS_TEST_FAILURE: failure,
        },
      },
    );
    assert.equal(result.status, failure === "1" ? 42 : 1);
    assert.match(result.stderr, /Could not remove the owned empty focused-test mount directory/u);
    const mounts = readdirSync(directory).filter((name) => name.startsWith("nexus-focus-empty."));
    assert.ok(
      mounts.some((name) => readFileSync(join(directory, name, "unexpected"), "utf8") === ""),
    );
  }
});
