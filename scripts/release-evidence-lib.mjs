import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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
  "release_evidence_harness",
  "database_migrations",
  "lint",
  "typecheck",
  "tests",
  "next_build",
  "repository_stability",
]);

export function repositoryStayedStable({ initialSha, finalSha, statusAvailable, dirty }) {
  return typeof initialSha === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(initialSha)
    && finalSha === initialSha && statusAvailable === true && dirty === false;
}

export function summarizeReleaseEvidence({ dirty, gates }) {
  const failedGates = gates
    .filter((gate) => gate.status === "failed")
    .map((gate) => gate.name);
  const blockedGates = gates
    .filter((gate) => gate.status === "blocked")
    .map((gate) => gate.name);
  const passedGates = gates
    .filter((gate) => gate.status === "passed")
    .map((gate) => gate.name);
  const incompleteGates = gates
    .filter(
      (gate) =>
        gate.status !== "passed" &&
        gate.status !== "failed" &&
        gate.status !== "blocked",
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
    complete:
      entries.length > 0 && missingOrInvalid.length === 0,
    missingOrInvalid,
  });
}

export function buildEvidenceChecksum(evidence) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}

export function executeReleaseCommand(command, args, { cwd, env, timeoutMs = 30 * 60_000, stdio = "inherit" } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError("Release command timeout must be a positive integer");
  }
  const startedAt = performance.now();
  const result = spawnSync(command, args, {
    cwd, env, stdio, shell: false, timeout: timeoutMs, killSignal: "SIGKILL",
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
    writeFileSync(temporaryPath, serialized, { encoding: "utf8", mode: 0o600, flag: "wx", flush: true });
    renameSync(temporaryPath, outputPath);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
