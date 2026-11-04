import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { BACKUP_RESTORE_EVIDENCE_FLAGS, BACKUP_RESTORE_LABEL } from "./backup-restore-contract.mjs";

export const PRODUCTION_RECOVERY_ACCEPTANCE_KIND = "production_recovery_acceptance";

const REPLACE_WITH_PLACEHOLDER = /REPLACE_WITH_/u;

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

/** True when a string still carries a REPLACE_WITH_* template token. */
export function containsReplaceWithPlaceholder(value) {
  return typeof value === "string" && REPLACE_WITH_PLACEHOLDER.test(value);
}

function rejectReplaceWithFields(fields) {
  for (const [label, value] of fields) {
    if (containsReplaceWithPlaceholder(value)) {
      return {
        ok: false,
        reason: `${label} still contains a REPLACE_WITH_* placeholder; recovery acceptance is not complete`,
      };
    }
  }
  return null;
}

/**
 * Validates owner-filled production recovery acceptance (F04 / OPS-13).
 * Never treats CI disposable backup-restore PASS as operational acceptance.
 * Rejects REPLACE_WITH_* leftovers even when verdict.passed is true.
 */
export function validateProductionRecoveryAcceptanceEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (isDisposableBackupRestoreRehearsalEvidence(evidence)) {
    return {
      ok: false,
      reason: "CI disposable backup-restore rehearsal is not production recovery acceptance (F04)",
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
  if (!nonEmptyString(access?.restoreRoles) || !nonEmptyString(access?.breakGlassProcedure)) {
    return { ok: false, reason: "restore access roles and break-glass procedure are required" };
  }
  const placeholderReject = rejectReplaceWithFields([
    ["owner.name", evidence.owner.name],
    ["environment.name", evidence.environment.name],
    ["retention.policy", retention.policy],
    ["retention.offHostLocation", retention.offHostLocation],
    ["access.restoreRoles", access.restoreRoles],
    ["access.breakGlassProcedure", access.breakGlassProcedure],
  ]);
  if (placeholderReject) return placeholderReject;
  const measured = evidence?.measuredRestore;
  const startedMs = parseInstant(measured?.startedAt);
  const completedMs = parseInstant(measured?.completedAt);
  if (startedMs === null || completedMs === null || completedMs < startedMs) {
    return {
      ok: false,
      reason: "measured restore requires ordered startedAt/completedAt timestamps",
    };
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
      reason:
        "measured restore must explicitly confirm withinRpo and withinRto against owner targets",
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

/**
 * Starter template for owner-filled F04 / OPS-13 acceptance.
 * Always ships with verdict.passed false and REPLACE_WITH_* tokens so it cannot close the live gate.
 */
export function buildProductionRecoveryAcceptanceEvidenceTemplate({
  generatedAt = new Date().toISOString(),
} = {}) {
  return withProductionRecoveryAcceptanceChecksum({
    schemaVersion: 1,
    kind: PRODUCTION_RECOVERY_ACCEPTANCE_KIND,
    generatedAt,
    environment: { name: "REPLACE_WITH_TARGET_ENV" },
    owner: { name: "REPLACE_WITH_ACCEPTANCE_OWNER" },
    targets: { rpoMinutes: 60, rtoMinutes: 240 },
    retention: {
      policy: "REPLACE_WITH_RETENTION_POLICY",
      offHostLocation: "REPLACE_WITH_OFF_HOST_LOCATION",
      offHostVerified: false,
    },
    access: {
      restoreRoles: "REPLACE_WITH_RESTORE_ROLES",
      breakGlassProcedure: "REPLACE_WITH_BREAK_GLASS_PROCEDURE",
    },
    measuredRestore: {
      startedAt: generatedAt,
      completedAt: generatedAt,
      dataLossMinutes: 0,
      withinRpo: false,
      withinRto: false,
    },
    limitations: Object.freeze([
      "Template only; replace placeholders after a real off-host recovery drill on the target environment.",
      "Does not authorize production deployment.",
      "CI disposable backup-restore PASS is not production recovery acceptance.",
    ]),
    verdict: Object.freeze({ passed: false, failures: Object.freeze(["template_not_executed"]) }),
  });
}

export function readProductionRecoveryAcceptanceFile(path) {
  if (!existsSync(path)) return null;
  return readJson(path);
}
