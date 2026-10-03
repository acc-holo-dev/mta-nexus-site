import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  REQUIRED_RELEASE_GATES,
  executeReleaseCommand,
  repositoryStayedStable,
  buildEvidenceChecksum,
  listMigrationEvidence,
  summarizeReleaseEvidence,
} from "../release-evidence-lib.mjs";

test("release summary passes only a clean tree with all gates passed", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
  });

  assert.equal(summary.status, "passed");
  assert.equal(summary.releaseCandidate, true);
  assert.deepEqual(summary.failedGates, []);
  assert.deepEqual(summary.blockedGates, []);
});

test("dirty trees remain blocked even when commands pass", () => {
  const summary = summarizeReleaseEvidence({
    dirty: true,
    gates: [{ name: "tests", status: "passed" }],
  });

  assert.equal(summary.status, "blocked");
  assert.equal(summary.releaseCandidate, false);
  assert.equal(summary.dirtyWorkingTree, true);
});

test("failed gates outrank blocked gates", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: [
      { name: "migrations", status: "blocked" },
      { name: "tests", status: "failed" },
    ],
  });

  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.failedGates, ["tests"]);
  assert.deepEqual(summary.blockedGates, ["migrations"]);
});

test("empty or unknown gate states remain blocked", () => {
  const empty = summarizeReleaseEvidence({
    dirty: false,
    gates: [],
  });
  assert.equal(empty.status, "blocked");
  assert.equal(empty.noGatesRecorded, true);

  const unknown = summarizeReleaseEvidence({
    dirty: false,
    gates: [{ name: "future_gate", status: "skipped" }],
  });
  assert.equal(unknown.status, "blocked");
  assert.deepEqual(unknown.incompleteGates, ["future_gate"]);
});

test("migration evidence is sorted and hashed without file contents", () => {
  const dir = mkdtempSync(join(tmpdir(), "nexus-release-evidence-"));
  writeFileSync(join(dir, "0002_b.sql"), "select 2;\n");
  writeFileSync(join(dir, "0001_a.sql"), "select 1;\n");
  writeFileSync(join(dir, "README.md"), "ignore");

  const migrations = listMigrationEvidence(dir);

  assert.deepEqual(
    migrations.map((item) => item.name),
    ["0001_a.sql", "0002_b.sql"],
  );
  assert.match(migrations[0].sha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(migrations).includes("select 1"), false);
});

test("evidence checksum changes with evidence content", () => {
  assert.notEqual(
    buildEvidenceChecksum({ status: "passed" }),
    buildEvidenceChecksum({ status: "failed" }),
  );
});

for (const missing of REQUIRED_RELEASE_GATES) {
  test(`release summary blocks missing required gate: ${missing}`, () => {
    const summary = summarizeReleaseEvidence({ dirty: false,
      gates: REQUIRED_RELEASE_GATES.filter((name) => name !== missing)
        .map((name) => ({ name, status: "passed" })),
    });
    assert.equal(summary.releaseCandidate, false);
    assert.equal(summary.status, "blocked");
    assert.deepEqual(summary.missingGates, [missing]);
  });
}
test("duplicate successes cannot replace required evidence", () => {
  const summary = summarizeReleaseEvidence({ dirty: false, gates: [
    ...REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
    { name: "tests", status: "passed" },
  ] });
  assert.equal(summary.status, "blocked");
  assert.deepEqual(summary.duplicateGates, ["tests"]);
});
test("repository cleanliness must be explicitly confirmed", () => {
  const summary = summarizeReleaseEvidence({
    gates: REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
  });
  assert.equal(summary.releaseCandidate, false);
});
test("additional successful gates do not invalidate complete evidence", () => {
  const summary = summarizeReleaseEvidence({ dirty: false, gates: [
    ...REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
    { name: "extra_check", status: "passed" },
  ] });
  assert.equal(summary.releaseCandidate, true);
});

test("repository stability requires the same readable clean checkout", () => {
  const initialSha = "a".repeat(40);
  const baseline = { initialSha, finalSha: initialSha, statusAvailable: true, dirty: false };
  assert.equal(repositoryStayedStable(baseline), true);
  for (const change of [
    { finalSha: "b".repeat(40) }, { finalSha: null }, { initialSha: null },
    { initialSha: "", finalSha: "" }, { statusAvailable: false },
    { dirty: true }, { dirty: undefined },
  ]) {
    assert.equal(repositoryStayedStable({ ...baseline, ...change }), false);
  }
});

test("release commands record success and nonzero exit without command output", () => {
  const success = executeReleaseCommand(process.execPath, ["-e", "console.log('private output')"], { stdio: "pipe", timeoutMs: 5000 });
  assert.equal(success.status, "passed");
  assert.equal(success.timedOut, false);
  assert.equal(JSON.stringify(success).includes("private output"), false);
  const failure = executeReleaseCommand(process.execPath, ["-e", "process.exit(7)"], { stdio: "pipe", timeoutMs: 5000 });
  assert.equal(failure.status, "failed");
  assert.equal(failure.exitCode, 7);
});
test("a stuck release command times out and cannot pass", () => {
  const result = executeReleaseCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe", timeoutMs: 200 });
  assert.equal(result.status, "failed");
  assert.equal(result.timedOut, true);
  assert.equal(result.errorCode, "ETIMEDOUT");
  assert.equal(result.timeoutMs, 200);
});
test("spawn errors and invalid timeout values cannot pass", () => {
  const result = executeReleaseCommand("nexus-missing-executable-for-test", [], { stdio: "pipe" });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "ENOENT");
  assert.throws(() => executeReleaseCommand(process.execPath, [], { timeoutMs: 0 }), RangeError);
});
