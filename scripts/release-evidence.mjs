#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";
import {
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
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function runGate(name, command, args, options = {}) {
  const commandText = [command, ...args].join(" ");
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

  process.stdout.write("\n==> " + name + ": " + commandText + "\n");
  const startedAt = performance.now();
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const exitCode = typeof result.status === "number" ? result.status : null;
  const passed = exitCode === 0 && !result.signal && !result.error;

  return Object.freeze({
    name,
    command: commandText,
    status: passed ? "passed" : "failed",
    exitCode,
    signal: result.signal ?? null,
    durationMs,
    ...(result.error
      ? { errorCode: result.error.code ?? "SPAWN_ERROR" }
      : {}),
  });
}

const gitSha = runCaptured("git", ["rev-parse", "HEAD"]);
const branchName =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  runCaptured("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const gitStatus = runCaptured("git", ["status", "--porcelain"]);
const dirty = Boolean(gitStatus);
const pnpmVersion = runCaptured(pnpmCommand, ["--version"]);
const gitVersion = runCaptured("git", ["--version"]);

const gates = [
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
  runGate("typecheck", pnpmCommand, ["typecheck"]),
  runGate("tests", pnpmCommand, ["test"]),
  runGate("next_build", pnpmCommand, ["build"]),
];

const migrationFiles = listMigrationEvidence(migrationsDir);
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
  gates,
  limitations: [
    "This bundle proves only the core application gates listed here.",
    "Docker startup, browser acceptance, external provider delivery, backup restore and production rollout require separate evidence.",
    "The bundle contains no environment variable values or command stdout/stderr.",
  ],
  summary: summarizeReleaseEvidence({ dirty, gates }),
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
