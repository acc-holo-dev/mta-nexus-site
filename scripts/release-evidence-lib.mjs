import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  evaluateInfraImagePins,
  INFRA_IMAGE_PIN_SCHEMA_VERSION,
  isImagePlatform,
  POSTGRES_VOLUME_PATH,
} from "./infra-image-policy.mjs";

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function listMigrationEvidence(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) =>
      Object.freeze({
        name: basename(name),
        sha256: sha256File(join(migrationsDir, name)),
      }),
    );
}

export const REQUIRED_RELEASE_GATES = Object.freeze([
  "repository_identity",
  "toolchain_policy",
  "release_evidence_harness",
  "database_migrations",
  "lint",
  "typecheck",
  "tests",
  "next_build",
  "repository_stability",
]);

export const EXTERNAL_RELEASE_EVIDENCE_SPECS = Object.freeze({
  webPushDurationSoak: Object.freeze({
    relativePath: "artifacts/web-push-soak-evidence.json",
    checker: "scripts/check-web-push-soak-evidence.mjs",
  }),
  webPushLiveProvider: Object.freeze({
    relativePath: "artifacts/web-push-provider-evidence.json",
    checker: "scripts/check-web-push-provider-evidence.mjs",
  }),
});

export function repositoryStayedStable({ initialSha, finalSha, statusAvailable, dirty }) {
  return (
    typeof initialSha === "string" &&
    /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(initialSha) &&
    finalSha === initialSha &&
    statusAvailable === true &&
    dirty === false
  );
}

export function summarizeReleaseEvidence({ dirty, gates }) {
  const failedGates = gates.filter((gate) => gate.status === "failed").map((gate) => gate.name);
  const blockedGates = gates.filter((gate) => gate.status === "blocked").map((gate) => gate.name);
  const passedGates = gates.filter((gate) => gate.status === "passed").map((gate) => gate.name);
  const incompleteGates = gates
    .filter(
      (gate) => gate.status !== "passed" && gate.status !== "failed" && gate.status !== "blocked",
    )
    .map((gate) => gate.name);
  const noGatesRecorded = gates.length === 0;
  const counts = new Map();
  for (const gate of gates) counts.set(gate.name, (counts.get(gate.name) ?? 0) + 1);
  const missingGates = REQUIRED_RELEASE_GATES.filter((name) => !counts.has(name));
  const duplicateGates = [...counts].filter(([, count]) => count > 1).map(([name]) => name);

  const status =
    failedGates.length > 0
      ? "failed"
      : dirty !== false ||
          missingGates.length > 0 ||
          duplicateGates.length > 0 ||
          blockedGates.length > 0 ||
          incompleteGates.length > 0 ||
          noGatesRecorded
        ? "blocked"
        : "passed";

  return Object.freeze({
    status,
    releaseCandidate: status === "passed",
    dirtyWorkingTree: dirty !== false,
    noGatesRecorded,
    missingGates,
    duplicateGates,
    passedGates,
    failedGates,
    blockedGates,
    incompleteGates,
  });
}

export function summarizeExternalEvidence(items) {
  const entries = Object.entries(items ?? {});
  const missingOrInvalid = entries
    .filter(
      ([, value]) =>
        value?.present !== true ||
        value?.valid !== true ||
        typeof value?.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.sha256),
    )
    .map(([name]) => name);
  return Object.freeze({
    complete: entries.length > 0 && missingOrInvalid.length === 0,
    missingOrInvalid,
  });
}

/** OPS-08 release candidate manifest (extends core release-evidence). */
export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;

/**
 * CI artifact retention is short. Durable release-bundle retention duration and
 * location are an owner decision (OPS-16); scripts must not invent a duration.
 */
export const RELEASE_RETENTION_CONTRACT = Object.freeze({
  ciArtifactDays: 14,
  releaseBundle: Object.freeze({
    status: "owner_decision_required",
    note: "Keep the current and required previous release bundles/images outside the 14-day CI cache; duration and store are owner-approved, not invented here.",
  }),
  secretsForbidden: true,
});

export const RELEASE_MANIFEST_ROLE_INVENTORY = Object.freeze([
  "app",
  "push-worker",
  "license-worker",
  "resource-release-worker",
  "mail-worker",
  "postgres",
  "clamav",
  "caddy",
]);

const SHA_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const DIGEST_RE = /^sha256:[a-f0-9]{64}$/u;

/**
 * Build a versioned release manifest document. productionAuthorized is always false.
 * Image digest may be unresolved until trusted GHCR publish records it (OPS-10/11).
 */
export function buildReleaseManifest({
  appVersion,
  sha,
  lockfileSha256,
  toolchain,
  image = null,
  infraImages = null,
  postgresMajor,
  schema,
  migrations,
  roles = RELEASE_MANIFEST_ROLE_INVENTORY,
  overlays = [],
  evidenceRefs = {},
  previousApprovedRelease = null,
  retention = RELEASE_RETENTION_CONTRACT,
} = {}) {
  return Object.freeze({
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    kind: "release_manifest",
    productionAuthorized: false,
    openBetaLive: false,
    appVersion: appVersion ?? null,
    repository: Object.freeze({
      sha: sha ?? null,
    }),
    toolchain: toolchain ?? null,
    lockfileSha256: lockfileSha256 ?? null,
    image: image
      ? Object.freeze({
          digest: image.digest ?? null,
          platform: image.platform ?? null,
          sourceSha: image.sourceSha ?? sha ?? null,
          status: image.status ?? (image.digest ? "resolved" : "unresolved"),
        })
      : Object.freeze({
          digest: null,
          platform: null,
          sourceSha: sha ?? null,
          status: "unresolved",
        }),
    infraImages: infraImages ?? null,
    postgresMajor: postgresMajor ?? null,
    schema: schema
      ? Object.freeze({
          baseline: schema.baseline ?? null,
          target: schema.target ?? null,
        })
      : null,
    migrations: migrations ?? null,
    inventory: Object.freeze({
      roles: Object.freeze([...(roles ?? [])]),
      overlays: Object.freeze([...(overlays ?? [])]),
      secretsRedacted: true,
    }),
    evidenceRefs: Object.freeze({ ...(evidenceRefs ?? {}) }),
    previousApprovedRelease: previousApprovedRelease ?? null,
    retention: Object.freeze({
      ciArtifactDays: retention?.ciArtifactDays ?? RELEASE_RETENTION_CONTRACT.ciArtifactDays,
      releaseBundle: Object.freeze({
        ...(retention?.releaseBundle ?? RELEASE_RETENTION_CONTRACT.releaseBundle),
      }),
      secretsForbidden: retention?.secretsForbidden !== false,
    }),
  });
}

/**
 * Strict evaluator for missing/mismatch digest, SHA, schema and unknown versions.
 * Does not grant productionAuthorized.
 */
export function evaluateReleaseManifest(
  manifest,
  {
    expectedSha = null,
    expectedSchema = null,
    requireImageDigest = false,
    requireResolvedInfra = false,
  } = {},
) {
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, status: "blocked", reason: "Release manifest is missing." };
  }
  if (manifest.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    return {
      ok: false,
      status: "blocked",
      reason: `Unknown release manifest schemaVersion ${manifest.schemaVersion ?? "missing"}; expected ${RELEASE_MANIFEST_SCHEMA_VERSION}.`,
    };
  }
  if (manifest.productionAuthorized === true || manifest.openBetaLive === true) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest must not auto-set productionAuthorized or openBetaLive.",
    };
  }
  if (typeof manifest.appVersion !== "string" || !manifest.appVersion) {
    return { ok: false, status: "blocked", reason: "Release manifest appVersion is missing." };
  }
  const sha = manifest.repository?.sha ?? null;
  if (typeof sha !== "string" || !SHA_RE.test(sha)) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest exact SHA is missing or invalid.",
    };
  }
  if (expectedSha && sha !== expectedSha) {
    return {
      ok: false,
      status: "blocked",
      reason: `Release manifest SHA mismatch: manifest=${sha}, expected=${expectedSha}.`,
    };
  }
  if (
    typeof manifest.lockfileSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(manifest.lockfileSha256)
  ) {
    return { ok: false, status: "blocked", reason: "Release manifest lockfileSha256 is missing." };
  }
  if (manifest.postgresMajor !== 18) {
    return {
      ok: false,
      status: "blocked",
      reason: `Release manifest postgresMajor is ${manifest.postgresMajor ?? "missing"}, expected 18.`,
    };
  }
  const baseline = manifest.schema?.baseline ?? null;
  const target = manifest.schema?.target ?? null;
  if (!baseline || !target) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest schema baseline/target are missing.",
    };
  }
  if (expectedSchema) {
    if (expectedSchema.baseline && baseline !== expectedSchema.baseline) {
      return {
        ok: false,
        status: "blocked",
        reason: `Release manifest schema baseline mismatch: ${baseline} !== ${expectedSchema.baseline}.`,
      };
    }
    if (expectedSchema.target && target !== expectedSchema.target) {
      return {
        ok: false,
        status: "blocked",
        reason: `Release manifest schema target mismatch: ${target} !== ${expectedSchema.target}.`,
      };
    }
  }
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest migration hashes are missing.",
    };
  }
  const migrationNames = new Set();
  for (const migration of manifest.migrations) {
    if (
      !migration ||
      typeof migration !== "object" ||
      Array.isArray(migration) ||
      typeof migration.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.sql$/u.test(migration.name) ||
      typeof migration.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(migration.sha256) ||
      migrationNames.has(migration.name)
    ) {
      return {
        ok: false,
        status: "blocked",
        reason: "Release manifest migration names and SHA-256 hashes must be valid and unique.",
      };
    }
    migrationNames.add(migration.name);
  }
  const image = manifest.image ?? {};
  if (image.sourceSha && image.sourceSha !== sha) {
    return {
      ok: false,
      status: "blocked",
      reason: `Release manifest image.sourceSha ${image.sourceSha} does not match repository SHA ${sha}.`,
    };
  }
  if (requireImageDigest) {
    if (!DIGEST_RE.test(image.digest ?? "")) {
      return {
        ok: false,
        status: "blocked",
        reason: "Release manifest app image digest is missing or invalid.",
      };
    }
    if (!isImagePlatform(image.platform)) {
      return {
        ok: false,
        status: "blocked",
        reason: "Release manifest app image platform is missing or invalid.",
      };
    }
    if (image.status !== "resolved" || image.sourceSha !== sha) {
      return {
        ok: false,
        status: "blocked",
        reason: "Release manifest app image must be resolved for the exact repository SHA.",
      };
    }
  } else if (image.status === "resolved" && !DIGEST_RE.test(image.digest ?? "")) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest marks image resolved without a valid digest.",
    };
  }
  if (image.digest && !DIGEST_RE.test(image.digest)) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest app image digest format is invalid.",
    };
  }
  if (requireResolvedInfra) {
    const result = evaluateInfraImagePins(
      {
        schemaVersion: INFRA_IMAGE_PIN_SCHEMA_VERSION,
        productionAuthorized: false,
        postgresMajor: manifest.postgresMajor,
        postgresVolumePath: POSTGRES_VOLUME_PATH,
        images: manifest.infraImages,
      },
      { requireResolved: true },
    );
    if (!result.ok) {
      return {
        ok: false,
        status: "blocked",
        reason: `Release manifest infra images: ${result.reason}`,
      };
    }
  }
  if (manifest.retention?.ciArtifactDays !== 14) {
    return {
      ok: false,
      status: "blocked",
      reason: "Release manifest must record CI artifact retention as 14 days.",
    };
  }
  if (manifest.retention?.releaseBundle?.status !== "owner_decision_required") {
    return {
      ok: false,
      status: "blocked",
      reason: "Release bundle retention must remain owner_decision_required until OPS-16.",
    };
  }

  return {
    ok: true,
    status: "passed",
    reason: null,
    releaseCandidateTechnical: true,
    productionAuthorized: false,
  };
}

export function buildEvidenceChecksum(evidence) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}

export function executeReleaseCommand(
  command,
  args,
  { cwd, env, timeoutMs = 30 * 60_000, stdio = "inherit" } = {},
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("Release command timeout must be a positive integer");
  }
  const startedAt = performance.now();
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio,
    shell: false,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  const exitCode = typeof result.status === "number" ? result.status : null;
  const timedOut = result.error?.code === "ETIMEDOUT";
  return Object.freeze({
    status: exitCode === 0 && !result.signal && !result.error ? "passed" : "failed",
    exitCode,
    signal: result.signal ?? null,
    durationMs: Math.round(performance.now() - startedAt),
    timeoutMs,
    timedOut,
    ...(result.error ? { errorCode: result.error.code ?? "SPAWN_ERROR" } : {}),
  });
}

export function writeReleaseEvidence(outputPath, evidence) {
  // Serialize before touching the filesystem; the temporary directory is on the
  // same volume as the destination so publication can use atomic rename.
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  const temporaryDirectory = mkdtempSync(join(dirname(outputPath), ".release-evidence-"));
  try {
    const temporaryPath = join(temporaryDirectory, "evidence.json");
    writeFileSync(temporaryPath, serialized, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
      flush: true,
    });
    renameSync(temporaryPath, outputPath);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
