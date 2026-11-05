import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateBetaCandidate, FULL_ACCEPTANCE_JOBS } from "../beta-candidate-lib.mjs";
import {
  BETA_CANDIDATE_ARTIFACT_TARGETS,
  fetchBetaCandidateEvidence,
  installStagedArtifacts,
  normalizeCandidateSha,
  pickArtifactName,
  resolveCandidateCommit,
  selectSuccessfulRun,
} from "../fetch-beta-candidate-evidence-lib.mjs";

const sha = "d".repeat(40);

test("short local commit IDs resolve to a full SHA before querying GitHub", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-fetch-git-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(root, "missing-global-config"),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
  git("init", "-q");
  writeFileSync(join(root, "fixture.txt"), "commit fixture\n");
  git("add", "fixture.txt");
  git("commit", "-qm", "fixture");
  const full = git("rev-parse", "HEAD");
  const short = git("rev-parse", "--short=12", "HEAD");
  let queried;
  assert.throws(
    () =>
      fetchBetaCandidateEvidence({
        sha: short,
        root,
        gh: {
          listRuns(value) {
            queried = value;
            return [];
          },
        },
      }),
    /No successful ci\.yml run/u,
  );
  assert.equal(queried, full);
  assert.throws(
    () => resolveCandidateCommit("0".repeat(40), { root }),
    /unambiguous local commit/u,
  );
  assert.throws(
    () =>
      resolveCandidateCommit(short, {
        root,
        execGit: () => ({ status: 128, stdout: "", stderr: "ambiguous argument" }),
      }),
    /unambiguous local commit/u,
  );
  let called = false;
  assert.throws(
    () =>
      fetchBetaCandidateEvidence({
        sha: "0".repeat(40),
        root,
        gh: {
          listRuns: () => {
            called = true;
            return [];
          },
        },
      }),
    /unambiguous local commit/u,
  );
  assert.equal(called, false);
});

test("failed downloads leave the complete previous evidence untouched", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-fetch-download-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "artifacts"));
  const names = [`ci-evidence-${sha}`, `release-upgrade-${sha}-1`, `backup-restore-${sha}-1`];
  const paths = BETA_CANDIDATE_ARTIFACT_TARGETS.map((target) => join(root, target.localPath));
  for (const [index, path] of paths.entries()) writeFileSync(path, `previous-${index}`);
  for (const failAt of [1, 2]) {
    let downloads = 0;
    const gh = {
      listRuns: () => [{ databaseId: 1, headSha: sha, conclusion: "success", status: "completed" }],
      listArtifacts: () => names.map((name) => ({ name, expired: false })),
      downloadArtifact(_runId, _name, directory) {
        if (downloads++ === failAt) throw new Error("download failed");
        writeFileSync(join(directory, "evidence.json"), "new");
      },
    };
    assert.throws(
      () => fetchBetaCandidateEvidence({ sha, root, gh, resolveCommit: (value) => value }),
      /download failed/u,
    );
    for (const [index, path] of paths.entries()) {
      assert.equal(readFileSync(path, "utf8"), `previous-${index}`);
    }
  }
});

test("failed installation restores previous files and removes newly installed files", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-beta-fetch-install-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const items = Array.from({ length: 3 }, (_, index) => ({
    payload: join(root, `new-${index}`),
    destination: join(root, `target-${index}`),
  }));
  for (const item of items) writeFileSync(item.payload, "new");
  writeFileSync(items[0].destination, "previous");
  let calls = 0;
  assert.throws(
    () =>
      installStagedArtifacts(items, root, {
        renameFile(from, to) {
          if (++calls === 3) throw new Error("install failed");
          renameSync(from, to);
        },
      }),
    /install failed/u,
  );
  assert.equal(readFileSync(items[0].destination, "utf8"), "previous");
  assert.equal(existsSync(items[1].destination), false);
  assert.equal(existsSync(items[2].destination), false);
});

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
      sha,
    )?.databaseId,
    2,
  );
  assert.equal(
    selectSuccessfulRun(
      [{ headSha: sha, conclusion: "success", status: "completed" }],
      sha.slice(0, 12),
    ),
    null,
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
    assert.throws(
      () => fetchBetaCandidateEvidence({ sha, root, gh, resolveCommit: (value) => value }),
      /backup_restore/u,
    );

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

    const result = fetchBetaCandidateEvidence({ sha, root, gh, resolveCommit: (value) => value });
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
