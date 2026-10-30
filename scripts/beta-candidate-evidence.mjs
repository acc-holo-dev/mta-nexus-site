#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildBetaCandidateChecksum,
  evaluateBetaCandidate,
  readCiEvidence,
} from "./beta-candidate-lib.mjs";
import { writeReleaseEvidence } from "./release-evidence-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "artifacts", "beta-candidate-evidence.json");

function runCaptured(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    timeout: 15_000,
    killSignal: "SIGKILL",
  });
  return Object.freeze({
    ok: result.status === 0 && !result.error,
    output: result.status === 0 && !result.error ? result.stdout.trim() : "",
  });
}

const gitShaResult = runCaptured("git", ["rev-parse", "HEAD"]);
const gitStatusResult = runCaptured("git", ["status", "--porcelain"]);
const candidateSha = process.env.NEXUS_BETA_CANDIDATE_SHA || gitShaResult.output || null;
const dirtyWorkingTree = gitStatusResult.ok ? Boolean(gitStatusResult.output) : true;
const ciEvidence = readCiEvidence(join(root, "artifacts", "ci-evidence.json"));

const evaluation = evaluateBetaCandidate({
  candidateSha,
  dirtyWorkingTree,
  ciEvidence,
  artifactRoot: root,
});

const evidenceCore = {
  ...evaluation,
  generatedAt: new Date().toISOString(),
  repository: {
    sha: candidateSha,
    githubSha: process.env.GITHUB_SHA || null,
    githubRunId: process.env.GITHUB_RUN_ID || null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  },
  project: {
    packageJsonHint: "Confirm package.json version separately; a version string is not acceptance.",
  },
};

const evidence = {
  ...evidenceCore,
  evidenceSha256: buildBetaCandidateChecksum(evidenceCore),
};

mkdirSync(join(root, "artifacts"), { recursive: true });
writeReleaseEvidence(outputPath, evidence);

process.stdout.write(
  `\nBeta candidate evidence: ${outputPath}\n` +
    `status=${evidence.status} checkableCandidate=${evidence.checkableCandidate} ` +
    `openBetaLive=${evidence.openBetaLive} productionAuthorized=${evidence.productionAuthorized}\n` +
    `sha=${candidateSha ?? "unknown"} evidenceSha256=${evidence.evidenceSha256}\n` +
    `technicalBlockers=${evidence.technicalBlockers.join(" | ") || "none"}\n` +
    `residuals=${evidence.residuals.join(" | ") || "none"}\n`,
);

// Exit 0 when the harness ran and named blockers honestly.
// Exit 1 only when the candidate is claimed checkable but owner deploy is still required? No —
// operators need a non-zero when not checkable so CI/scripts can gate on readiness.
if (!evidence.checkableCandidate) {
  process.exitCode = 1;
}
