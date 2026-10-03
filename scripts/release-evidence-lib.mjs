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

export const REQUIRED_RELEASE_GATES = Object.freeze([
  "repository_identity",
  "release_evidence_harness",
  "database_migrations",
  "lint",
  "typecheck",
  "tests",
  "next_build",
]);

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

export function buildEvidenceChecksum(evidence) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}
