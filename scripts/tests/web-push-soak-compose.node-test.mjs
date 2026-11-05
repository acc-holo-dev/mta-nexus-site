import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("Compose soak waits for healthy Postgres without waiting for its container to stop", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-soak-health-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "calls");
  const docker = join(directory, "docker");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$SOAK_TEST_LOG"
case "$*" in
  *'ps postgres --format'*) echo "$SOAK_TEST_HEALTH" ;;
  *'ps app --status running --quiet'*) echo app-id ;;
  *'ps app --format'*) echo healthy ;;
  *' wait '*) exit 99 ;;
esac
`,
  );
  chmodSync(docker, 0o755);
  for (const executable of ["node", "sleep"]) {
    const path = join(directory, executable);
    writeFileSync(path, "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(path, 0o755);
  }

  for (const health of ["healthy", "unhealthy"]) {
    writeFileSync(log, "");
    const result = spawnSync("bash", ["scripts/run-web-push-soak-compose.sh"], {
      encoding: "utf8",
      timeout: 5_000,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        NEXUS_WEB_PUSH_SOAK_ACK: "YES",
        SOAK_TEST_LOG: log,
        SOAK_TEST_HEALTH: health,
      },
    });
    const calls = readFileSync(log, "utf8");
    assert.doesNotMatch(calls, /(?:^|\s)wait(?:\s|$)/u);
    assert.match(calls, /ps postgres --format/u);
    if (health === "healthy") {
      assert.equal(result.status, 0, result.stderr);
      assert.match(calls, /run --rm --no-deps/u);
    } else {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Postgres is not healthy/u);
      assert.doesNotMatch(calls, /stop push-worker|run --rm/u);
    }
  }
});

test("Compose soak restores only a previously running worker, including on failure", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-soak-worker-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "calls");
  const docker = join(directory, "docker");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$SOAK_TEST_LOG"
case "$*" in
  *'ps postgres --format'*|*'ps app --format'*) echo healthy ;;
  *'ps app --status running --quiet'*) echo app-id ;;
  *'ps push-worker --status running --quiet'*) [[ "$SOAK_TEST_RUNNING" != 1 ]] || echo worker-id ;;
  *'stop push-worker'*) [[ "$SOAK_TEST_FAIL" != stop ]] ;;
  *'start push-worker'*) [[ "$SOAK_TEST_FAIL" != start ]] ;;
  *'run --rm --no-deps'*) [[ "$SOAK_TEST_FAIL" != run ]] ;;
esac
`,
  );
  chmodSync(docker, 0o755);
  const node = join(directory, "node");
  writeFileSync(node, "#!/usr/bin/env bash\nexit 0\n");
  chmodSync(node, 0o755);

  for (const scenario of ["success", "run", "stop", "start", "not-running"]) {
    writeFileSync(log, "");
    const result = spawnSync("bash", ["scripts/run-web-push-soak-compose.sh"], {
      encoding: "utf8",
      timeout: 5_000,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        NEXUS_WEB_PUSH_SOAK_ACK: "YES",
        SOAK_TEST_LOG: log,
        SOAK_TEST_RUNNING: scenario === "not-running" ? "0" : "1",
        SOAK_TEST_FAIL: scenario,
      },
    });
    const calls = readFileSync(log, "utf8");
    if (scenario === "success" || scenario === "not-running")
      assert.equal(result.status, 0, result.stderr);
    else assert.notEqual(result.status, 0);
    if (scenario === "not-running") {
      assert.doesNotMatch(calls, /(?:stop|start) push-worker/u);
    } else {
      assert.match(calls, /stop push-worker/u);
      assert.match(calls, /start push-worker/u);
      assert.ok(calls.indexOf("stop push-worker") < calls.indexOf("start push-worker"));
    }
    if (scenario === "stop") assert.doesNotMatch(calls, /run --rm --no-deps/u);
    if (scenario === "start") assert.match(result.stderr, /Failed to restore push-worker/u);
  }
});
