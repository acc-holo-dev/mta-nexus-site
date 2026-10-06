import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root exposes release:verify without adding runtime dependencies", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["release:verify"], "node scripts/release-evidence.mjs");
});

test("CI runs separate test projects and reports the selected verification scope", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /pnpm test:unit/u);
  assert.match(workflow, /pnpm test:database/u);
  assert.match(workflow, /node scripts\/ci-summary\.mjs/u);
  assert.match(workflow, /toJSON\(needs\)/u);
  assert.doesNotMatch(workflow, /run: pnpm release:verify/u);
});

test("core release evidence records lint as its own gate", () => {
  const script = read("scripts/release-evidence.mjs");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(
    pkg.scripts.check,
    "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  );
  assert.match(
    script,
    /runGate\("lint", pnpmCommand, \["lint"\]\)/u,
  );
  assert.match(
    script,
    /runGate\("typecheck", pnpmCommand, \["typecheck"\]\)/u,
  );
});

test("generated release evidence is not tracked by default", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^artifacts\/$/mu);
});

test("evidence command does not serialize environment values or command output", () => {
  const script = read("scripts/release-evidence.mjs");
  assert.doesNotMatch(script, /JSON\.stringify\(process\.env\)/u);
  assert.doesNotMatch(script, /environment:\s*process\.env/u);
  assert.doesNotMatch(script, /stdout\s*:/u);
  assert.doesNotMatch(script, /stderr\s*:/u);
  assert.match(script, /process\.env\.DATABASE_URL/u);
  assert.match(script, /evidenceSha256/u);
});

test("repository stability is checked after command execution and feeds the summary", () => {
  const script = read("scripts/release-evidence.mjs");
  assert.ok(script.indexOf("const finalShaResult") > script.indexOf('runGate("next_build"'));
  assert.match(script, /gates\.push\(runGate\("repository_stability"/u);
  assert.match(script, /dirty: dirty \|\| finalDirty/u);
});

test("CI keeps selected-scope evidence strict for releases without coupling branch correctness to artifact quota", () => {
  const workflow = read(".github/workflows/ci.yml");
  const section = workflow.slice(workflow.indexOf("  summary:"));
  const summaryStep = section.indexOf("Require every gate for the selected scope");
  const artifactStep = section.indexOf("Preserve scope and exact commit result");
  assert.match(section, /always\(\)/u);
  assert.ok(summaryStep >= 0 && artifactStep > summaryStep);
  assert.match(section, /path: artifacts\/ci-evidence\.json/u);
  assert.match(section, /if-no-files-found: error/u);
  assert.match(section, /retention-days: 14/u);
  assert.match(section, /continue-on-error: \$\{\{ github\.ref_type != 'tag' \}\}/u);
  assert.doesNotMatch(section, /include-hidden-files/u);
});

test("mail worker CI expects current structured terminal events", () => {
  const workflow = read(".github/workflows/ci.yml");
  const production = read("scripts/check-production-mail-worker.sh");
  assert.ok(production.includes("export TRUSTED_PROXY_SECRET=disposable-mail-worker-proxy-config-only"));
  assert.match(workflow, /'"status":"stopped"' \/tmp\/account-mail-once\.json/u);
  assert.match(workflow, /'"status":"stopped"' \/tmp\/account-mail-loop\.json/u);
  for (const text of [workflow, production]) {
    assert.ok(text.includes("grep -Fxq '{\"status\":\"failed\"}'"));
    assert.ok(!text.includes("Account mail dispatcher failed"));
  }
});

test("production mail acceptance isolates its queue before seeding and dispatching", () => {
  const script = read("scripts/check-production-mail-worker.sh");
  const create = script.indexOf("CREATE DATABASE nexus_mail_acceptance");
  const migrate = script.indexOf("pnpm --filter @nexus/db migrate");
  const seed = script.indexOf("phase=seed-synthetic-mail");
  assert.ok(create > script.indexOf("phase=runner-guard"));
  assert.ok(migrate > create && seed > migrate);
  assert.match(script, /export DATABASE_URL=postgres:\/\/[^\n]+@localhost:5432\/nexus_mail_acceptance/u);
  const workerUrls = [...script.matchAll(/--env DATABASE_URL=([^\s]+)/gu)];
  assert.equal(workerUrls.length, 2);
  for (const [, url] of workerUrls) {
    assert.ok(url.endsWith("@host.docker.internal:5432/nexus_mail_acceptance"));
  }
  assert.doesNotMatch(script, /TRUNCATE|DELETE FROM|DROP DATABASE/iu);
});

test("mail worker crash probe signals only the inspected container process", () => {
  const script = read("scripts/check-production-mail-worker.sh");
  const crash = script.slice(script.indexOf("phase=supervised-crash-restart"), script.indexOf("phase=graceful-recreate"));
  assert.ok(crash.includes("sleep 10"));
  assert.ok(crash.includes("docker inspect --format '{{.State.Pid}}' \"$worker\""));
  assert.ok(crash.includes('"$worker_pid" -gt 1'));
  assert.ok(crash.includes('sudo kill -KILL "$worker_pid"'));
  assert.doesNotMatch(crash, /^docker (?:kill|stop|restart|start) /mu);
  assert.ok(crash.includes('"$restart_now" -gt "$restart_before"'));
  assert.ok(crash.includes('"$ready_now" -gt "$ready_before"'));
});

test("expected missing-key failures are captured without triggering the ERR trap", () => {
  const script = read("scripts/check-production-mail-worker.sh");
  const section = script.slice(script.indexOf("phase=missing-key-fail-closed"));
  const command = section.slice(section.indexOf("if docker run"), section.indexOf('test "$code" -ne 0'))
    .replaceAll("/tmp/nexus-d5-missing.out", "/dev/null")
    .replaceAll("/tmp/nexus-d5-missing.err", "/dev/null");
  assert.ok(command.startsWith("if docker run"));
  for (const exitCode of [0, 1, 125]) {
    const result = spawnSync("bash", ["-c", `set -Ee
trap 'exit 99' ERR
docker() { return ${exitCode}; }
${command}
printf '%s' "$code"`], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, String(exitCode));
  }
});
