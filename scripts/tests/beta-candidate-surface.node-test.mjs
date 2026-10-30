import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  BETA_CANDIDATE_CATEGORIES,
  evaluateBetaCandidate,
  FULL_ACCEPTANCE_JOBS,
} from "../beta-candidate-lib.mjs";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root exposes beta:candidate without runtime dependencies", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["beta:fetch"], "node scripts/fetch-beta-candidate-evidence.mjs");
  assert.equal(pkg.scripts["beta:candidate"], "node scripts/beta-candidate-evidence.mjs");
  assert.match(pkg.scripts["test:tooling"] ?? "", /./u);
});

test("generated beta candidate evidence stays untracked", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^artifacts\/$/mu);
});

test("CI summary records per-job results for beta candidate evaluation", () => {
  const summary = read("scripts/ci-summary.mjs");
  assert.match(summary, /requiredJobs/u);
  assert.match(summary, /jobResults/u);
  assert.match(summary, /requiredJobs\(policy\)/u);
});

test("full acceptance still requires backup-restore for ROADMAP 19 residual evidence", () => {
  assert.ok(FULL_ACCEPTANCE_JOBS.includes("backup-restore"));
  assert.ok(FULL_ACCEPTANCE_JOBS.includes("mail-worker"));
  assert.ok(
    BETA_CANDIDATE_CATEGORIES.some(
      (item) => item.id === "backup_restore" && item.required === true,
    ),
  );
});

test("synthetic PASS artifacts yield checkable candidate awaiting owner deploy", () => {
  const sha = "b".repeat(40);
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-candidate-"));
  try {
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(
      join(root, "artifacts", "release-upgrade.json"),
      JSON.stringify({ status: "PASS", sha }),
    );
    writeFileSync(
      join(root, "artifacts", "backup-restore-evidence.json"),
      JSON.stringify({
        status: "PASS",
        sha,
        sourceDestroyedBeforeRestore: true,
        backupChecksumsVerified: true,
        databaseRowsRestored: true,
        applicationSchemaRestored: true,
        applicationRowsRestored: true,
        migrationLedgerRestored: true,
        uploadFilesRestored: true,
        cleanupComplete: true,
      }),
    );
    const report = evaluateBetaCandidate({
      candidateSha: sha,
      dirtyWorkingTree: false,
      artifactRoot: root,
      ciEvidence: {
        sha,
        scope: "full_acceptance",
        status: "PASS",
        jobResults: Object.fromEntries(FULL_ACCEPTANCE_JOBS.map((name) => [name, "success"])),
      },
    });
    assert.equal(report.checkableCandidate, true);
    assert.equal(report.status, "awaiting_owner_deploy_decision");
    assert.equal(report.openBetaLive, false);
    assert.equal(report.productionAuthorized, false);
    assert.deepEqual(report.technicalBlockers, []);
    assert.ok(report.blockers.some((item) => item.startsWith("deployment_authorization:")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
