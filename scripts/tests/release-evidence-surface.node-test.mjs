import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  EXTERNAL_RELEASE_EVIDENCE_SPECS,
  executeReleaseCommand,
  REQUIRED_RELEASE_GATES,
  repositoryStayedStable,
  summarizeExternalEvidence,
  summarizeReleaseEvidence,
} from "../release-evidence-lib.mjs";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root exposes release:verify without adding runtime dependencies", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["release:verify"], "node scripts/release-evidence.mjs");
});

test("CI runs separate test projects and reports the selected verification scope", () => {
  const workflow = read(".github/workflows/ci.yml");
  const pkg = JSON.parse(read("package.json"));
  assert.match(workflow, /pnpm check:code/u);
  const selector = pkg.scripts["check:code"].match(/"\/([^"]+)\/"$/u);
  assert.ok(selector, "check:code must select explicit scripts");
  const pattern = new RegExp(selector[1]);
  assert.deepEqual(
    Object.keys(pkg.scripts)
      .filter((name) => pattern.test(name))
      .sort(),
    [
      "analyze:architecture",
      "analyze:unused",
      "format:check",
      "lint",
      "test:tooling",
      "test:unit",
      "typecheck",
    ],
  );
  assert.match(pkg.scripts["check:code"], /--sequential --no-bail/u);
  assert.match(pkg.scripts["test:unit"], /--project unit\b/u);
  assert.match(pkg.scripts["test:unit"], /--outputFile=artifacts\/unit-tests\.json/u);
  assert.match(workflow, /pnpm test:database/u);
  assert.match(workflow, /node scripts\/ci-summary\.mjs/u);
  assert.match(workflow, /toJSON\(needs\)/u);
  assert.doesNotMatch(workflow, /run: pnpm release:verify/u);
});

test("core release evidence requires every named gate including lint and typecheck", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(
    pkg.scripts.check,
    "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  );

  assert.deepEqual(REQUIRED_RELEASE_GATES, [
    "repository_identity",
    "release_evidence_harness",
    "database_migrations",
    "lint",
    "typecheck",
    "tests",
    "next_build",
    "repository_stability",
  ]);

  const passed = REQUIRED_RELEASE_GATES.map((name) => ({
    name,
    status: "passed",
  }));
  assert.equal(
    summarizeReleaseEvidence({
      dirty: false,
      gates: passed,
    }).releaseCandidate,
    true,
  );

  const withoutLint = passed.filter((gate) => gate.name !== "lint");
  const incomplete = summarizeReleaseEvidence({
    dirty: false,
    gates: withoutLint,
  });
  assert.equal(incomplete.releaseCandidate, false);
  assert.deepEqual(incomplete.missingGates, ["lint"]);
});

test("generated release evidence is not tracked by default", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^artifacts\/$/mu);
});

test("release command results never serialize stdout or stderr payloads", () => {
  const result = executeReleaseCommand(
    process.execPath,
    ["-e", "process.stdout.write('secret-out'); process.stderr.write('secret-err')"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      timeoutMs: 5_000,
    },
  );

  assert.equal(result.status, "passed");
  assert.equal("stdout" in result, false);
  assert.equal("stderr" in result, false);
  assert.equal("output" in result, false);
  assert.equal(result.timeoutMs, 5_000);
});

test("repository stability is a fail-closed exact-SHA contract", () => {
  const sha = "a".repeat(40);
  assert.equal(
    repositoryStayedStable({
      initialSha: sha,
      finalSha: sha,
      statusAvailable: true,
      dirty: false,
    }),
    true,
  );

  for (const candidate of [
    {
      initialSha: sha,
      finalSha: "b".repeat(40),
      statusAvailable: true,
      dirty: false,
    },
    {
      initialSha: sha,
      finalSha: sha,
      statusAvailable: false,
      dirty: false,
    },
    {
      initialSha: sha,
      finalSha: sha,
      statusAvailable: true,
      dirty: true,
    },
    {
      initialSha: "not-a-sha",
      finalSha: "not-a-sha",
      statusAvailable: true,
      dirty: false,
    },
  ]) {
    assert.equal(repositoryStayedStable(candidate), false);
  }
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
  assert.ok(
    production.includes("export TRUSTED_PROXY_SECRET=disposable-mail-worker-proxy-config-only"),
  );
  assert.match(workflow, /'"status":"stopped"' \/tmp\/account-mail-once\.json/u);
  assert.match(workflow, /'"status":"stopped"' \/tmp\/account-mail-loop\.json/u);
  for (const text of [workflow, production]) {
    assert.ok(text.includes('grep -Fxq \'{"status":"failed"}\''));
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
  assert.match(
    script,
    /export DATABASE_URL=postgres:\/\/[^\n]+@localhost:5432\/nexus_mail_acceptance/u,
  );
  const workerUrls = [...script.matchAll(/--env DATABASE_URL=([^\s]+)/gu)];
  assert.equal(workerUrls.length, 2);
  for (const [, url] of workerUrls) {
    assert.ok(url.endsWith("@host.docker.internal:5432/nexus_mail_acceptance"));
  }
  assert.doesNotMatch(script, /TRUNCATE|DELETE FROM|DROP DATABASE/iu);
});

test("mail worker crash probe signals only the inspected container process", () => {
  const script = read("scripts/check-production-mail-worker.sh");
  const crash = script.slice(
    script.indexOf("phase=supervised-crash-restart"),
    script.indexOf("phase=graceful-recreate"),
  );
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
  const command = section
    .slice(section.indexOf("if docker run"), section.indexOf('test "$code" -ne 0'))
    .replaceAll("/tmp/nexus-d5-missing.out", "/dev/null")
    .replaceAll("/tmp/nexus-d5-missing.err", "/dev/null");
  assert.ok(command.startsWith("if docker run"));
  for (const exitCode of [0, 1, 125]) {
    const result = spawnSync(
      "bash",
      [
        "-c",
        `set -Ee
trap 'exit 99' ERR
docker() { return ${exitCode}; }
${command}
printf '%s' "$code"`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, String(exitCode));
  }
});

test("Web Push external release evidence is referenced by sanitized manifest and checksum status only", () => {
  assert.deepEqual(EXTERNAL_RELEASE_EVIDENCE_SPECS, {
    webPushDurationSoak: {
      relativePath: "artifacts/web-push-soak-evidence.json",
      checker: "scripts/check-web-push-soak-evidence.mjs",
    },
    webPushLiveProvider: {
      relativePath: "artifacts/web-push-provider-evidence.json",
      checker: "scripts/check-web-push-provider-evidence.mjs",
    },
  });

  const validSha = "a".repeat(64);
  assert.deepEqual(
    summarizeExternalEvidence({
      webPushDurationSoak: {
        present: true,
        valid: true,
        sha256: validSha,
      },
      webPushLiveProvider: {
        present: true,
        valid: true,
        sha256: validSha,
      },
    }),
    {
      complete: true,
      missingOrInvalid: [],
    },
  );

  assert.deepEqual(
    summarizeExternalEvidence({
      webPushDurationSoak: {
        present: false,
        valid: false,
        sha256: null,
      },
    }),
    {
      complete: false,
      missingOrInvalid: ["webPushDurationSoak"],
    },
  );
});
