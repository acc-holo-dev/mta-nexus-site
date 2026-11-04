import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { BACKUP_RESTORE_EVIDENCE_FLAGS, BACKUP_RESTORE_LABEL } from "./backup-restore-contract.mjs";

export const PRODUCTION_RECOVERY_ACCEPTANCE_KIND = "production_recovery_acceptance";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function checksumMatches(evidence) {
  if (!evidence || typeof evidence !== "object") return false;
  const { evidenceSha256, ...core } = evidence;
  const expected = createHash("sha256").update(JSON.stringify(core)).digest("hex");
  return typeof evidenceSha256 === "string" && evidenceSha256 === expected;
}

export function withProductionRecoveryAcceptanceChecksum(core) {
  return {
    ...core,
    evidenceSha256: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
}

/** True when the payload is CI disposable backup-restore rehearsal output, not F04 acceptance. */
export function isDisposableBackupRestoreRehearsalEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return false;
  if (evidence.kind === PRODUCTION_RECOVERY_ACCEPTANCE_KIND) return false;
  const flagHits = BACKUP_RESTORE_EVIDENCE_FLAGS.filter((flag) => flag in evidence);
  if (flagHits.length > 0) return true;
  if (evidence.scope === "disposable_ci_rehearsal") return true;
  if (evidence.rehearsal === "github_actions_disposable") return true;
  if (evidence.environment?.domain === "backup-restore.invalid") return true;
  if (evidence.labels?.[BACKUP_RESTORE_LABEL]) return true;
  if (
    evidence.status === "PASS" &&
    evidence.kind !== PRODUCTION_RECOVERY_ACCEPTANCE_KIND &&
    !evidence.acceptance
  ) {
    return true;
  }
  return false;
}

function parseInstant(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Validates owner-filled production recovery acceptance (F04 / OPS-13).
 * Never treats CI disposable backup-restore PASS as operational acceptance.
 */
export function validateProductionRecoveryAcceptanceEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (isDisposableBackupRestoreRehearsalEvidence(evidence)) {
    return {
      ok: false,
      reason:
        "CI disposable backup-restore rehearsal is not production recovery acceptance (F04)",
    };
  }
  if (evidence.schemaVersion !== 1 || evidence.kind !== PRODUCTION_RECOVERY_ACCEPTANCE_KIND) {
    return { ok: false, reason: "unexpected schema or evidence kind" };
  }
  if (!checksumMatches(evidence)) {
    return { ok: false, reason: "evidence checksum mismatch" };
  }
  if (evidence?.verdict?.passed !== true) {
    return {
      ok: false,
      reason: `acceptance verdict is not passed: ${JSON.stringify(evidence?.verdict?.failures ?? [])}`,
    };
  }
  if (!nonEmptyString(evidence?.owner?.name)) {
    return { ok: false, reason: "owner name is required" };
  }
  if (!nonEmptyString(evidence?.environment?.name)) {
    return { ok: false, reason: "target environment name is required" };
  }
  const targets = evidence?.targets;
  if (!positiveNumber(targets?.rpoMinutes) || !positiveNumber(targets?.rtoMinutes)) {
    return { ok: false, reason: "owner must record positive RPO and RTO targets in minutes" };
  }
  const retention = evidence?.retention;
  if (
    !nonEmptyString(retention?.policy) ||
    !nonEmptyString(retention?.offHostLocation) ||
    retention?.offHostVerified !== true
  ) {
    return {
      ok: false,
      reason: "retention policy, off-host location and offHostVerified are required",
    };
  }
  const access = evidence?.access;
  if (
    !nonEmptyString(access?.restoreRoles) ||
    !nonEmptyString(access?.breakGlassProcedure)
  ) {
    return { ok: false, reason: "restore access roles and break-glass procedure are required" };
  }
  const measured = evidence?.measuredRestore;
  const startedMs = parseInstant(measured?.startedAt);
  const completedMs = parseInstant(measured?.completedAt);
  if (startedMs === null || completedMs === null || completedMs < startedMs) {
    return { ok: false, reason: "measured restore requires ordered startedAt/completedAt timestamps" };
  }
  if (
    typeof measured?.dataLossMinutes !== "number" ||
    !Number.isFinite(measured.dataLossMinutes) ||
    measured.dataLossMinutes < 0
  ) {
    return { ok: false, reason: "measured dataLossMinutes must be a non-negative number" };
  }
  if (measured.withinRpo !== true || measured.withinRto !== true) {
    return {
      ok: false,
      reason: "measured restore must explicitly confirm withinRpo and withinRto against owner targets",
    };
  }
  if (measured.dataLossMinutes > targets.rpoMinutes) {
    return { ok: false, reason: "measured data loss exceeds declared RPO target" };
  }
  const durationMinutes = (completedMs - startedMs) / 60_000;
  if (durationMinutes > targets.rtoMinutes) {
    return { ok: false, reason: "measured restore duration exceeds declared RTO target" };
  }
  return { ok: true, reason: null };
}

export function readProductionRecoveryAcceptanceFile(path) {
  if (!existsSync(path)) return null;
  return readJson(path);
}
