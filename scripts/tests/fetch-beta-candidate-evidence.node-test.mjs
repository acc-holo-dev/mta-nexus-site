import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateBetaCandidate, FULL_ACCEPTANCE_JOBS } from "../beta-candidate-lib.mjs";
import {
  BETA_CANDIDATE_ARTIFACT_TARGETS,
  fetchBetaCandidateEvidence,
  normalizeCandidateSha,
  pickArtifactName,
  selectSuccessfulRun,
} from "../fetch-beta-candidate-evidence-lib.mjs";

const sha = "d".repeat(40);

test("artifact name picker prefers the newest attempt and never invents names", () => {
  assert.equal(
    pickArtifactName([`ci-evidence-${sha}`, `ci-evidence-${sha}-1`, "other"], {
      namePrefix: "ci-evidence-",
      sha,
      requireAttemptSuffix: false,
    }),
    `ci-evidence-${sha}`,
  );
  assert.equal(
    pickArtifactName(
      [`backup-restore-${sha}-1`, `backup-restore-${sha}-3`, `backup-restore-${sha}`],
      { namePrefix: "backup-restore-", sha, requireAttemptSuffix: true },
    ),
    `backup-restore-${sha}-3`,
  );
  assert.equal(
    pickArtifactName([`backup-restore-${sha}`], {
      namePrefix: "backup-restore-",
      sha,
      requireAttemptSuffix: true,
    }),
    null,
  );
});

test("successful run selection requires completed success for the candidate SHA", () => {
  assert.equal(
    selectSuccessfulRun(
      [
        {
          databaseId: 1,
          headSha: sha,
          conclusion: "failure",
          status: "completed",
          createdAt: "2026-10-30T10:00:00Z",
        },
        {
          databaseId: 2,
          headSha: sha,
          conclusion: "success",
          status: "completed",
          createdAt: "2026-10-30T11:00:00Z",
        },
      ],
      sha.slice(0, 12),
    )?.databaseId,
    2,
  );
  assert.equal(selectSuccessfulRun([], sha), null);
});

test("fetch installs retained JSON only and fails honestly when backup-restore is missing", () => {
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-fetch-"));
  const downloads = new Map();
  try {
    const gh = {
      listRuns() {
        return [
          {
            databaseId: 99,
            headSha: sha,
            conclusion: "success",
            status: "completed",
            createdAt: "2026-10-30T12:00:00Z",
            url: "https://example.test/runs/99",
          },
        ];
      },
      listArtifacts() {
        return [
          { name: `ci-evidence-${sha}`, expired: false },
          { name: `release-upgrade-${sha}-1`, expired: false },
        ];
      },
      downloadArtifact() {
        throw new Error("should not download when backup-restore is absent");
      },
    };
    assert.throws(() => fetchBetaCandidateEvidence({ sha, root, gh }), /backup_restore/u);

    gh.listArtifacts = () => [
      { name: `ci-evidence-${sha}`, expired: false },
      { name: `release-upgrade-${sha}-1`, expired: false },
      { name: `backup-restore-${sha}-2`, expired: false },
    ];
    gh.downloadArtifact = (_runId, name, directory) => {
      mkdirSync(directory, { recursive: true });
      const payload = name.startsWith("backup-restore-")
        ? {
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
          }
        : name.startsWith("release-upgrade-")
          ? { status: "PASS", sha }
          : {
              sha,
              scope: "full_acceptance",
              status: "PASS",
              jobResults: Object.fromEntries(FULL_ACCEPTANCE_JOBS.map((job) => [job, "success"])),
            };
      writeFileSync(join(directory, "nested.json"), JSON.stringify(payload));
      downloads.set(name, true);
    };

    const result = fetchBetaCandidateEvidence({ sha, root, gh });
    assert.equal(result.runId, 99);
    assert.equal(result.sha, sha);
    assert.equal(downloads.size, BETA_CANDIDATE_ARTIFACT_TARGETS.length);
    assert.equal(
      JSON.parse(readFileSync(join(root, "artifacts/backup-restore-evidence.json"), "utf8")).status,
      "PASS",
    );

    const report = evaluateBetaCandidate({
      candidateSha: sha,
      dirtyWorkingTree: false,
      ciEvidence: JSON.parse(readFileSync(join(root, "artifacts/ci-evidence.json"), "utf8")),
      artifactRoot: root,
    });
    assert.equal(report.categories.find((item) => item.id === "backup_restore")?.status, "passed");
    assert.equal(report.openBetaLive, false);
    assert.equal(report.productionAuthorized, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("incomplete disposable flags never clear ROADMAP 19 residual", () => {
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-incomplete-"));
  try {
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(
      join(root, "artifacts/release-upgrade.json"),
      JSON.stringify({ status: "PASS", sha }),
    );
    writeFileSync(
      join(root, "artifacts/backup-restore-evidence.json"),
      JSON.stringify({
        status: "PASS",
        sha,
        sourceDestroyedBeforeRestore: true,
        cleanupComplete: true,
      }),
    );
    const report = evaluateBetaCandidate({
      candidateSha: sha,
      dirtyWorkingTree: false,
      ciEvidence: {
        sha,
        scope: "full_acceptance",
        status: "PASS",
        jobResults: Object.fromEntries(FULL_ACCEPTANCE_JOBS.map((job) => [job, "success"])),
      },
      artifactRoot: root,
    });
    const backup = report.categories.find((item) => item.id === "backup_restore");
    assert.equal(backup?.status, "blocked");
    assert.match(backup?.reason ?? "", /incomplete/u);
    assert.equal(report.checkableCandidate, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("normalizeCandidateSha rejects non-hex placeholders", () => {
  assert.equal(normalizeCandidateSha("d98a7b10"), "d98a7b10");
  assert.equal(normalizeCandidateSha("not-a-sha"), null);
});
