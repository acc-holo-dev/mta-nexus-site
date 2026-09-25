import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildEvidenceChecksum,
  listMigrationEvidence,
  summarizeReleaseEvidence,
} from "../release-evidence-lib.mjs";

test("release summary passes only a clean tree with all gates passed", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: [
      { name: "typecheck", status: "passed" },
      { name: "tests", status: "passed" },
    ],
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
