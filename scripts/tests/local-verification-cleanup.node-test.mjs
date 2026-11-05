import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const hasPowerShell = spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"]).status === 0;

for (const shell of ["bash", ...(hasPowerShell ? ["pwsh"] : [])]) {
  test(`${shell} local verification refuses unverified state and reports PASS only after cleanup`, (t) => {
    const directory = mkdtempSync(join(tmpdir(), "nexus-local-verify-test-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const docker = join(directory, "docker");
    const log = join(directory, "calls");
    const count = join(directory, "volume-count");
    writeFileSync(
      docker,
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$VERIFY_TEST_LOG"
case "$*" in
  'context show') echo default; [[ "$VERIFY_TEST_SCENARIO" != context-fail ]] || exit 50 ;;
  'ps -aq '*) [[ "$VERIFY_TEST_SCENARIO" != ps-fail ]] || exit 51 ;;
  'volume ls '*)
    count=0; [[ ! -f "$VERIFY_TEST_COUNT" ]] || count=$(cat "$VERIFY_TEST_COUNT")
    count=$((count + 1)); printf '%s' "$count" > "$VERIFY_TEST_COUNT"
    [[ "$VERIFY_TEST_SCENARIO" != pre-volume-fail || "$count" != 1 ]] || exit 52
    [[ "$VERIFY_TEST_SCENARIO" != post-volume-fail || "$count" != 2 ]] || exit 53
    if [[ "$VERIFY_TEST_SCENARIO" == remaining && "$count" == 2 ]]; then echo remaining-volume; fi ;;
  *' up --build '*) [[ "$VERIFY_TEST_SCENARIO" != up-fail ]] || exit 42 ;;
  *' down --volumes '*)
    echo FAKE_DOWN_COMPLETE
    [[ "$VERIFY_TEST_SCENARIO" != down-fail && "$VERIFY_TEST_SCENARIO" != up-fail ]] || exit 77 ;;
esac
exit 0
`,
    );
    chmodSync(docker, 0o755);
    for (const scenario of [
      "success",
      "context-fail",
      "ps-fail",
      "pre-volume-fail",
      "post-volume-fail",
      "remaining",
      "down-fail",
      "up-fail",
    ]) {
      writeFileSync(log, "");
      rmSync(count, { force: true });
      const args =
        shell === "bash"
          ? ["scripts/check-local-verification.sh"]
          : ["-NoProfile", "-File", "scripts/check-local-verification.ps1"];
      const result = spawnSync(shell, args, {
        encoding: "utf8",
        timeout: 5_000,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          DOCKER_HOST: "",
          DOCKER_CONTEXT: "",
          GITHUB_ACTIONS: "false",
          NEXUS_LOCAL_VERIFY: "true",
          VERIFY_TEST_LOG: log,
          VERIFY_TEST_COUNT: count,
          VERIFY_TEST_SCENARIO: scenario,
        },
      });
      const calls = readFileSync(log, "utf8");
      if (scenario === "success") {
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /PASS:/u);
        assert.ok(result.stdout.indexOf("FAKE_DOWN_COMPLETE") < result.stdout.indexOf("PASS:"));
      } else {
        assert.notEqual(result.status, 0, scenario);
        assert.doesNotMatch(result.stdout, /PASS:/u);
      }
      if (["context-fail", "ps-fail", "pre-volume-fail"].includes(scenario)) {
        assert.doesNotMatch(calls, / up --build | down --volumes /u);
      }
      if (scenario === "up-fail" && shell === "bash") assert.equal(result.status, 42);
    }
  });
}
