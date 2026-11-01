export const RELEASE_UPGRADE_BASELINE_TAG = "0024_product_type_invariant";
export const RELEASE_UPGRADE_FAILURE_TAG = "0027_build_quarantine";
export const RELEASE_UPGRADE_TARGET_TAG = "0089_resource_qa";

/** Current written evidence schema. Legacy retained CI artifacts may omit this field. */
export const RELEASE_UPGRADE_EVIDENCE_SCHEMA_VERSION = 1;

export const RELEASE_UPGRADE_COMPLETE_PHASE = "complete";

/**
 * Boolean verification/cleanup flags required for technical upgrade PASS.
 * Presence of status:"PASS" alone is never enough.
 */
export const RELEASE_UPGRADE_EVIDENCE_FLAGS = Object.freeze([
  "failedMigrationRolledBack",
  "legacyRowsPreserved",
  "retrySucceeded",
  "rerunIdempotent",
  "structuredNotificationAccepted",
  "notificationInboxIndexesPresent",
  "userLibraryIndexesPresent",
  "serverActivityIndexPresent",
  "serverClaimScopePresent",
  "supportSchemaPresent",
  "supportStaffQueueIndexPresent",
  "supportStaffFilterIndexPresent",
  "supportMutationIdempotencyPresent",
  "serverEndpointRevisionPresent",
  "legacyServerProofInvalidated",
  "webPushSubscriptionSchemaPresent",
  "webPushOutboxSchemaPresent",
  "resourceReviewSchemaPresent",
  "resourceBuildWorkspaceSchemaPresent",
  "commerceOrderCaseSchemaPresent",
  "licenseBindingRecoverySchemaPresent",
  "licenseTermMaintenanceSchemaPresent",
  "resourceMetadataReviewSchemaPresent",
  "resourceDeliveryReceiptsSchemaPresent",
  "resourceReleaseWatchesSchemaPresent",
  "resourceCartReceiptsSchemaPresent",
  "buildPackageEvidenceSchemaPresent",
  "resourceMediaSchemaPresent",
  "storageMaintenanceSchemaPresent",
  "sellerSalesIndexesPresent",
  "orderTermsSchemaPresent",
  "planReviewsSchemaPresent",
  "resourceCopiesSchemaPresent",
  "accountSubscriptionsSchemaPresent",
  "libraryCollectionsSchemaPresent",
  "reportNotificationDeliverySchemaPresent",
  "supportNotificationDeliverySchemaPresent",
  "verificationNotificationDeliverySchemaPresent",
  "discussionNotificationDeliverySchemaPresent",
  "publicationNotificationDeliverySchemaPresent",
  "buildIncidentNotificationDeliverySchemaPresent",
  "webPushAdmissionRecoverySchemaPresent",
  "cleanupComplete",
]);

function journalEntries(journal) {
  if (!journal || !Array.isArray(journal.entries)) {
    throw new Error("Release upgrade journal is invalid");
  }
  return journal.entries;
}

function tagIndex(entries, tag) {
  const index = entries.findIndex((entry) => entry?.tag === tag);
  if (index < 0) {
    throw new Error(`Release upgrade journal is missing required migration: ${tag}`);
  }
  return index;
}

export function releaseUpgradePlan(journal) {
  const entries = journalEntries(journal);
  if (entries.length === 0) {
    throw new Error("Release upgrade journal is empty");
  }

  const baselineIndex = tagIndex(entries, RELEASE_UPGRADE_BASELINE_TAG);
  const failureIndex = tagIndex(entries, RELEASE_UPGRADE_FAILURE_TAG);
  const targetIndex = tagIndex(entries, RELEASE_UPGRADE_TARGET_TAG);

  if (targetIndex !== entries.length - 1) {
    throw new Error(
      `Release upgrade target must match latest migration; expected review after ${RELEASE_UPGRADE_TARGET_TAG}`,
    );
  }
  if (baselineIndex >= failureIndex || failureIndex > targetIndex) {
    throw new Error(
      "Release upgrade failure injection must be after baseline and at or before target",
    );
  }

  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index]?.idx !== index) {
      throw new Error("Release upgrade journal indexes must be contiguous");
    }
  }

  return Object.freeze({
    baselineTag: RELEASE_UPGRADE_BASELINE_TAG,
    failureTag: RELEASE_UPGRADE_FAILURE_TAG,
    targetTag: RELEASE_UPGRADE_TARGET_TAG,
    baselineIndex,
    failureIndex,
    targetIndex,
    baselineEntries: Object.freeze(entries.slice(0, baselineIndex + 1)),
  });
}

function resolveEvidenceSha(body) {
  const sha = body?.sha ?? body?.repository?.sha ?? body?.commit ?? null;
  return typeof sha === "string" && sha.length > 0 ? sha : null;
}

function shaMatches(candidateSha, reportedSha) {
  return (
    typeof candidateSha === "string" &&
    typeof reportedSha === "string" &&
    candidateSha.length >= 40 &&
    reportedSha.startsWith(candidateSha.slice(0, 40))
  );
}

/**
 * Build a full-format upgrade evidence object for tests / writers.
 * Set `includeSchemaVersion: false` to mirror retained historical CI artifacts.
 */
export function createReleaseUpgradeEvidence({
  sha,
  status = "PASS",
  phase = RELEASE_UPGRADE_COMPLETE_PHASE,
  baseline = RELEASE_UPGRADE_BASELINE_TAG,
  target = RELEASE_UPGRADE_TARGET_TAG,
  includeSchemaVersion = true,
  schemaVersion = RELEASE_UPGRADE_EVIDENCE_SCHEMA_VERSION,
  flagValue = true,
  overrides = null,
} = {}) {
  const evidence = {
    ...(includeSchemaVersion ? { schemaVersion } : {}),
    status,
    sha: sha ?? null,
    baseline,
    target,
    phase,
    ...Object.fromEntries(RELEASE_UPGRADE_EVIDENCE_FLAGS.map((flag) => [flag, flagValue])),
  };
  return overrides ? { ...evidence, ...overrides } : evidence;
}

/**
 * Pure technical validator for release-upgrade evidence.
 * Does not authorize production deploy.
 *
 * Compatibility: retained full-format artifacts that omit `schemaVersion` are
 * accepted as schemaVersion 1 when identity, phase, baseline/target and all
 * required boolean flags are otherwise valid. Unknown schemaVersion fails.
 */
export function evaluateReleaseUpgradeEvidence(body, { candidateSha = null } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "release-upgrade evidence is missing or not an object." };
  }

  if ("schemaVersion" in body) {
    if (body.schemaVersion !== RELEASE_UPGRADE_EVIDENCE_SCHEMA_VERSION) {
      return {
        ok: false,
        reason: `release-upgrade schemaVersion is ${String(body.schemaVersion)}, expected ${RELEASE_UPGRADE_EVIDENCE_SCHEMA_VERSION} or omitted legacy full format.`,
      };
    }
  }

  if (body.status !== "PASS") {
    return {
      ok: false,
      reason: `release-upgrade status is ${body.status ?? "unknown"}, not PASS.`,
    };
  }

  const sha = resolveEvidenceSha(body);
  if (!sha) {
    return { ok: false, reason: "release-upgrade evidence is missing the candidate SHA." };
  }
  if (candidateSha && !shaMatches(candidateSha, sha)) {
    return {
      ok: false,
      reason: "release-upgrade evidence SHA does not match the candidate commit.",
    };
  }

  if (body.baseline !== RELEASE_UPGRADE_BASELINE_TAG) {
    return {
      ok: false,
      reason: `release-upgrade baseline is ${body.baseline ?? "unknown"}, expected ${RELEASE_UPGRADE_BASELINE_TAG}.`,
    };
  }
  if (body.target !== RELEASE_UPGRADE_TARGET_TAG) {
    return {
      ok: false,
      reason: `release-upgrade target is ${body.target ?? "unknown"}, expected ${RELEASE_UPGRADE_TARGET_TAG}.`,
    };
  }
  if (body.phase !== RELEASE_UPGRADE_COMPLETE_PHASE) {
    return {
      ok: false,
      reason: `release-upgrade phase is ${body.phase ?? "unknown"}, expected ${RELEASE_UPGRADE_COMPLETE_PHASE}.`,
    };
  }

  const incompleteFlags = RELEASE_UPGRADE_EVIDENCE_FLAGS.filter((flag) => body[flag] !== true);
  if (incompleteFlags.length) {
    return {
      ok: false,
      reason: `release-upgrade evidence incomplete: ${incompleteFlags.join(", ")}.`,
      incompleteFlags,
    };
  }

  return { ok: true, reason: null };
}

export function assertReleaseUpgradeEvidence(body, options = {}) {
  const result = evaluateReleaseUpgradeEvidence(body, options);
  if (!result.ok) {
    throw new Error(result.reason ?? "release-upgrade evidence failed validation");
  }
}
