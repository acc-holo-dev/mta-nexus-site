#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  RELEASE_UPGRADE_BASELINE_TAG,
  RELEASE_UPGRADE_TARGET_TAG,
} from "../packages/db/scripts/release-upgrade-contract.mjs";
import { assertDisposableTestDatabase } from "./disposable-test-database.mjs";
import { evaluateInfraImagePins, readInfraImagePins } from "./infra-image-policy.mjs";
import {
  buildEvidenceChecksum,
  buildReleaseManifest,
  EXTERNAL_RELEASE_EVIDENCE_SPECS,
  evaluateReleaseManifest,
  executeReleaseCommand,
  listMigrationEvidence,
  REQUIRED_RELEASE_GATES,
  repositoryStayedStable,
  sha256File,
  summarizeExternalEvidence,
  summarizeReleaseEvidence,
  writeReleaseEvidence,
} from "./release-evidence-lib.mjs";
import { collectRepositoryToolchain, evaluateToolchainPolicy } from "./toolchain-policy.mjs";

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
    output: result.status === 0 && !result.error ? result.stdout.trim() : "",
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

  process.stdout.write(`\n==> ${name}: ${commandText}\n`);
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
  process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || gitBranchResult.output || null;
const dirty = gitStatusResult.ok ? Boolean(gitStatusResult.output) : true;
const pnpmVersion = pnpmVersionResult.output || null;
const gitVersion = gitVersionResult.output || null;
const githubShaMatches = !process.env.GITHUB_SHA || process.env.GITHUB_SHA === gitSha;
const identityComplete =
  gitShaResult.ok &&
  gitStatusResult.ok &&
  pnpmVersionResult.ok &&
  gitVersionResult.ok &&
  Boolean(gitSha && branchName && pnpmVersion && gitVersion) &&
  githubShaMatches;

const repositoryToolchain = collectRepositoryToolchain(root, packageJson);
const toolchainEvaluation = evaluateToolchainPolicy({
  actualNode: process.versions.node,
  actualPnpm: pnpmVersion,
  enginesNode: repositoryToolchain.enginesNode,
  exactNodePin: repositoryToolchain.nodePin.ok ? repositoryToolchain.nodePin.pin : null,
  exactPnpmPin: repositoryToolchain.pnpmPin,
  mode: "release",
});
const toolchainComplete =
  repositoryToolchain.nodePin.ok && Boolean(repositoryToolchain.pnpmPin) && toolchainEvaluation.ok;

let databaseBlockedReason = null;
try {
  assertDisposableTestDatabase();
} catch (error) {
  databaseBlockedReason = error.message;
}

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
    "toolchain_policy",
    "internal",
    [],
    toolchainComplete
      ? {}
      : {
          blockedReason: repositoryToolchain.nodePin.ok
            ? "Release toolchain requires engines major-ok plus exact Node (.nvmrc/.node-version) and pnpm (packageManager) matches; unexplained divergence is not a candidate."
            : (repositoryToolchain.nodePin.reason ??
              "Repository Node pin files are missing, invalid, or disagree."),
        },
  ),
  runGate("release_evidence_harness", "node", [
    "--test",
    "scripts/tests/release-evidence.node-test.mjs",
    "scripts/tests/release-evidence-surface.node-test.mjs",
  ]),
  runGate("database_migrations", pnpmCommand, ["db:migrate"], {
    blockedReason: databaseBlockedReason,
  }),
  runGate("lint", pnpmCommand, ["lint"]),
  runGate("typecheck", pnpmCommand, ["typecheck"]),
  // Same Vitest split as CI (unit without APP_URL, database with APP_URL).
  runGate("tests", "node", ["scripts/run-ci-aligned-vitest.mjs"], {
    blockedReason: databaseBlockedReason,
  }),
  runGate("next_build", pnpmCommand, ["build"]),
];

const externalEvidenceSpecs = Object.fromEntries(
  Object.entries(EXTERNAL_RELEASE_EVIDENCE_SPECS).map(([name, specification]) => [
    name,
    {
      path: join(root, specification.relativePath),
      checker: specification.checker,
    },
  ]),
);

const externalEvidence = Object.fromEntries(
  Object.entries(externalEvidenceSpecs).map(([name, specification]) => {
    if (!existsSync(specification.path)) {
      return [
        name,
        Object.freeze({
          present: false,
          valid: false,
          sha256: null,
        }),
      ];
    }

    const verification = runCaptured(process.execPath, [specification.checker, specification.path]);
    return [
      name,
      Object.freeze({
        present: true,
        valid: verification.ok,
        sha256: sha256File(specification.path),
      }),
    ];
  }),
);
const externalEvidenceSummary = summarizeExternalEvidence(externalEvidence);

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
gates.push(
  runGate(
    "repository_stability",
    "internal",
    [],
    repositoryStable
      ? {}
      : {
          blockedReason:
            "Repository HEAD changed, the working tree became dirty, or final Git identity is unavailable.",
        },
  ),
);
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
  toolchain: {
    policy: {
      enginesNode: repositoryToolchain.enginesNode,
      enginesPnpm: repositoryToolchain.enginesPnpm,
      exactNodePin: repositoryToolchain.nodePin.ok ? repositoryToolchain.nodePin.pin : null,
      exactPnpmPin: repositoryToolchain.pnpmPin,
      dockerNodeImage: repositoryToolchain.dockerNodeImage,
      note: "engines = major-ok local compatibility; .nvmrc/.node-version and packageManager = exact release pins; Docker node:26-alpine follows the major branch.",
    },
    actual: {
      node: process.versions.node,
      pnpm: pnpmVersion,
    },
    evaluation: toolchainEvaluation,
    lockfileSha256: sha256File(lockfilePath),
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
  externalEvidence: {
    items: externalEvidence,
    summary: externalEvidenceSummary,
  },
  limitations: [
    "This bundle proves only the core application gates listed here.",
    "Docker startup, browser acceptance, backup restore and production rollout require separate evidence.",
    "Core releaseCandidate status does not imply public production readiness; externalEvidence summarizes optional Web Push provider/soak artifacts separately.",
    "The bundle contains no environment variable values or command stdout/stderr.",
  ],
  summary: summarizeReleaseEvidence({ dirty: dirty || finalDirty, gates }),
};

const infraPins = (() => {
  try {
    return readInfraImagePins(root);
  } catch {
    return null;
  }
})();
const infraPinEvaluation = infraPins
  ? evaluateInfraImagePins(infraPins, { requireResolved: false })
  : { ok: false, reason: "deploy/infra-image-pins.json is missing." };

const releaseManifest = buildReleaseManifest({
  appVersion: packageJson.version,
  sha: gitSha,
  lockfileSha256: sha256File(lockfilePath),
  toolchain: {
    policy: evidenceCore.toolchain.policy,
    actual: evidenceCore.toolchain.actual,
    evaluation: toolchainEvaluation,
  },
  image: {
    digest: null,
    platform: null,
    sourceSha: gitSha,
    status: "unresolved",
  },
  infraImages: infraPins?.images ?? null,
  postgresMajor: infraPins?.postgresMajor ?? 18,
  schema: {
    baseline: RELEASE_UPGRADE_BASELINE_TAG,
    target: RELEASE_UPGRADE_TARGET_TAG,
  },
  migrations: migrationFiles,
  overlays: [
    "deploy/compose.production.yaml",
    "deploy/compose.production-ci.yaml (CI only)",
    "deploy/compose.recovery.yaml (optional)",
    "deploy/compose.mail-worker.yaml (optional)",
  ],
  evidenceRefs: {
    coreReleaseEvidence: "artifacts/release-evidence.json",
    ciEvidence: "artifacts/ci-evidence.json",
    releaseUpgrade: "artifacts/release-upgrade.json",
    backupRestore: "artifacts/backup-restore-evidence.json",
  },
});
const releaseManifestEvaluation = evaluateReleaseManifest(releaseManifest, {
  expectedSha: gitSha,
  expectedSchema: {
    baseline: RELEASE_UPGRADE_BASELINE_TAG,
    target: RELEASE_UPGRADE_TARGET_TAG,
  },
  requireImageDigest: false,
  requireResolvedInfra: false,
});

Object.assign(evidenceCore, {
  releaseManifest,
  releaseManifestEvaluation,
  infraImagePins: {
    evaluation: infraPinEvaluation,
    productionAuthorized: false,
  },
});

const evidence = {
  ...evidenceCore,
  evidenceSha256: buildEvidenceChecksum(evidenceCore),
};

mkdirSync(join(root, "artifacts"), { recursive: true });
writeReleaseEvidence(outputPath, evidence);

process.stdout.write(
  "\nRelease evidence: " +
    outputPath +
    "\n" +
    "status=" +
    evidence.summary.status +
    " sha=" +
    (gitSha ?? "unknown") +
    " evidenceSha256=" +
    evidence.evidenceSha256 +
    "\n",
);

if (!evidence.summary.releaseCandidate) {
  process.exitCode = 1;
}
