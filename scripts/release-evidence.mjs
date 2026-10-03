#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import {
  REQUIRED_RELEASE_GATES,
  executeReleaseCommand,
  repositoryStayedStable,
  buildEvidenceChecksum,
  listMigrationEvidence,
  sha256File,
  summarizeReleaseEvidence,
} from "./release-evidence-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outputPath = join(root, "artifacts", "release-evidence.json");
const packageJsonPath = join(root, "package.json");
const lockfilePath = join(root, "pnpm-lock.yaml");
const migrationsDir = join(root, "packages", "db", "migrations");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

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
    output:
      result.status === 0 && !result.error
        ? result.stdout.trim()
        : "",
  });
}

function runGate(name, command, args, options = {}) {
  const commandText =
    command === "internal" ? "internal identity checks" : [command, ...args].join(" ");
  if (options.blockedReason) {
    return Object.freeze({
      name,
      command: commandText,
      status: "blocked",
      exitCode: null,
      signal: null,
      durationMs: 0,
      reason: options.blockedReason,
    });
  }

  if (command === "internal") {
    return Object.freeze({
      name,
      command: commandText,
      status: "passed",
      exitCode: 0,
      signal: null,
      durationMs: 0,
    });
  }

  process.stdout.write("\n==> " + name + ": " + commandText + "\n");
  return Object.freeze({
    name,
    command: commandText,
    ...executeReleaseCommand(command, args, { cwd: root, env: process.env }),
  });
}

const gitShaResult = runCaptured("git", ["rev-parse", "HEAD"]);
const gitBranchResult = runCaptured("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const gitStatusResult = runCaptured("git", ["status", "--porcelain"]);
const pnpmVersionResult = runCaptured(pnpmCommand, ["--version"]);
const gitVersionResult = runCaptured("git", ["--version"]);

const gitSha = gitShaResult.output || null;
const branchName =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  gitBranchResult.output ||
  null;
const dirty = gitStatusResult.ok ? Boolean(gitStatusResult.output) : true;
const pnpmVersion = pnpmVersionResult.output || null;
const gitVersion = gitVersionResult.output || null;
const githubShaMatches =
  !process.env.GITHUB_SHA || process.env.GITHUB_SHA === gitSha;
const identityComplete =
  gitShaResult.ok &&
  gitStatusResult.ok &&
  pnpmVersionResult.ok &&
  gitVersionResult.ok &&
  Boolean(gitSha && branchName && pnpmVersion && gitVersion) &&
  githubShaMatches;

const gates = [
  runGate(
    "repository_identity",
    "internal",
    [],
    identityComplete
      ? {}
      : {
          blockedReason:
            "Git/pnpm identity is incomplete or GITHUB_SHA does not match the checked-out commit.",
        },
  ),
  runGate(
    "release_evidence_harness",
    "node",
    [
      "--test",
      "scripts/tests/release-evidence.node-test.mjs",
      "scripts/tests/release-evidence-surface.node-test.mjs",
    ],
  ),
  runGate(
    "database_migrations",
    pnpmCommand,
    ["db:migrate"],
    process.env.DATABASE_URL
      ? {}
      : {
          blockedReason:
            "DATABASE_URL is required to prove migrations against a database.",
        },
  ),
  runGate("lint", pnpmCommand, ["lint"]),
  runGate("typecheck", pnpmCommand, ["typecheck"]),
  runGate("tests", pnpmCommand, ["test"]),
  runGate("next_build", pnpmCommand, ["build"]),
];

const migrationFiles = listMigrationEvidence(migrationsDir);
// Re-read after all commands and migration hashing: successful gates must not
// be attributed to a checkout that changed while they were running.
const finalShaResult = runCaptured("git", ["rev-parse", "HEAD"]);
const finalStatusResult = runCaptured("git", ["status", "--porcelain"]);
const finalSha = finalShaResult.ok ? finalShaResult.output : null;
const finalDirty = finalStatusResult.ok ? Boolean(finalStatusResult.output) : true;
const repositoryStable = repositoryStayedStable({
  initialSha: gitSha,
  finalSha,
  statusAvailable: finalStatusResult.ok,
  dirty: finalDirty,
});
gates.push(runGate("repository_stability", "internal", [], repositoryStable ? {} : {
  blockedReason: "Repository HEAD changed, the working tree became dirty, or final Git identity is unavailable.",
}));
const evidenceCore = {
  schemaVersion: 1,
  scope: "core_application",
  generatedAt: new Date().toISOString(),
  repository: {
    sha: gitSha,
    branch: branchName,
    dirty,
    githubSha: process.env.GITHUB_SHA || null,
    githubRunId: process.env.GITHUB_RUN_ID || null,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    githubShaMatches,
    finalSha,
    finalDirty,
    stableAtCompletion: repositoryStable,
  },
  runtime: {
    node: process.version,
    pnpm: pnpmVersion,
    git: gitVersion,
    platform: process.platform,
    arch: process.arch,
  },
  project: {
    name: packageJson.name,
    version: packageJson.version,
    packageManager: packageJson.packageManager,
    engines: packageJson.engines,
    lockfileSha256: sha256File(lockfilePath),
  },
  migrations: {
    count: migrationFiles.length,
    files: migrationFiles,
  },
  requiredGates: REQUIRED_RELEASE_GATES,
  gates,
  limitations: [
    "This bundle proves only the core application gates listed here.",
    "Docker startup, browser acceptance, external provider delivery, backup restore and production rollout require separate evidence.",
    "The bundle contains no environment variable values or command stdout/stderr.",
  ],
  summary: summarizeReleaseEvidence({ dirty: dirty || finalDirty, gates }),
};

const evidence = {
  ...evidenceCore,
  evidenceSha256: buildEvidenceChecksum(evidenceCore),
};

mkdirSync(join(root, "artifacts"), { recursive: true });
writeFileSync(outputPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");

process.stdout.write(
  "\nRelease evidence: " + outputPath + "\n" +
  "status=" + evidence.summary.status +
  " sha=" + (gitSha ?? "unknown") +
  " evidenceSha256=" + evidence.evidenceSha256 + "\n",
);

if (!evidence.summary.releaseCandidate) {
  process.exitCode = 1;
}
