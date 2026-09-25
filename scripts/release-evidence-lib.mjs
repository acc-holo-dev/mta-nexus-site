import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

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

  const status =
    failedGates.length > 0
      ? "failed"
      : dirty ||
          blockedGates.length > 0 ||
          incompleteGates.length > 0 ||
          noGatesRecorded
        ? "blocked"
        : "passed";

  return Object.freeze({
    status,
    releaseCandidate: status === "passed",
    dirtyWorkingTree: dirty,
    noGatesRecorded,
    passedGates,
    failedGates,
    blockedGates,
    incompleteGates,
  });
}

export function buildEvidenceChecksum(evidence) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}
