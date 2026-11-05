import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const OBSERVABILITY_READINESS_KIND = "observability_operator_readiness";
export const OBSERVABILITY_LIVE_DRILL_KIND = "observability_live_drill";
const CLOCK_SKEW_MS = 5 * 60_000;

/** Required in-repo operator scripts that prove alert/health probes exist. */
export const OBSERVABILITY_REQUIRED_SCRIPTS = Object.freeze([
  "scripts/check-local-readiness.mjs",
  "scripts/check-web-push-worker-health.mjs",
  "scripts/check-web-push-worker-queue.mjs",
  "scripts/check-account-mail-worker-health.mjs",
  "scripts/check-license-worker-health.mjs",
  "scripts/check-resource-release-worker-health.mjs",
  "apps/web/src/lib/observability.ts",
  "docs/OPERATIONS.md",
]);

/** Queue alert threshold env keys already used by the push worker. */
export const OBSERVABILITY_ALERT_ENV_KEYS = Object.freeze([
  "WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT",
  "WEB_PUSH_QUEUE_ALERT_DUE_JOBS",
  "WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS",
]);

// Mirrors readQueueAlertThreshold in packages/db/scripts/run-web-push-dispatcher.ts.
const ALERT_THRESHOLD_LIMITS = Object.freeze({
  WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: [1, 99],
  WEB_PUSH_QUEUE_ALERT_DUE_JOBS: [1, 50_000],
  WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: [1, 86_400],
});

function validAlertThreshold(key, value) {
  const limits = ALERT_THRESHOLD_LIMITS[key];
  return !!limits && Number.isSafeInteger(value) && value >= limits[0] && value <= limits[1];
}

/** Literal strings that must appear in docs/OPERATIONS.md (match probe alert names). */
export const OBSERVABILITY_RUNBOOK_MENTIONS = Object.freeze([
  "report_delivery_failed",
  "support_delivery_failed",
  "verification_delivery_failed",
  "discussion_delivery_failed",
  "publication_delivery_failed",
  "build_incident_delivery_failed",
  "check-web-push-worker-queue",
]);

/**
 * Live-drill signalName whitelist: failure signals from the operator runbook.
 * Excludes the probe script name (not an injectable failure signal).
 */
export const OBSERVABILITY_LIVE_DRILL_SIGNAL_NAMES = Object.freeze(
  OBSERVABILITY_RUNBOOK_MENTIONS.filter((name) => name !== "check-web-push-worker-queue"),
);

/** Threshold keys a live drill may exercise (same set as readiness alert env). */
export const OBSERVABILITY_LIVE_DRILL_THRESHOLD_KEYS = Object.freeze([
  ...OBSERVABILITY_ALERT_ENV_KEYS,
]);

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

export function withObservabilityChecksum(core) {
  return {
    ...core,
    evidenceSha256: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
}

/**
 * Build readiness evidence from repo + env. Does not claim production vendor contracts.
 */
export function buildObservabilityReadinessEvidence({
  repoRoot = process.cwd(),
  env = process.env,
  generatedAt = new Date().toISOString(),
} = {}) {
  const failures = [];
  const scripts = {};
  for (const relative of OBSERVABILITY_REQUIRED_SCRIPTS) {
    const absolute = resolve(repoRoot, relative);
    const present = existsSync(absolute);
    scripts[relative] = present;
    if (!present) failures.push(`missing:${relative}`);
  }

  const alerts = {};
  for (const key of OBSERVABILITY_ALERT_ENV_KEYS) {
    const raw = env[key]?.trim() ?? "";
    const value = Number(raw);
    const configured = /^[0-9]+$/u.test(raw) && validAlertThreshold(key, value);
    alerts[key] = configured ? "configured" : "missing";
    if (!configured) failures.push(`alert_env:${key}`);
  }

  const operations = readFileSync(resolve(repoRoot, "docs/OPERATIONS.md"), "utf8");
  const runbook = {};
  for (const needle of OBSERVABILITY_RUNBOOK_MENTIONS) {
    const ok = operations.includes(needle);
    runbook[needle] = ok;
    if (!ok) failures.push(`runbook:${needle}`);
  }

  const structuredLogging = existsSync(resolve(repoRoot, "apps/web/src/lib/observability.ts"));
  if (!structuredLogging) failures.push("structured_logging_module");

  const verdict = Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze([...failures]),
  });

  return withObservabilityChecksum({
    schemaVersion: 1,
    kind: OBSERVABILITY_READINESS_KIND,
    generatedAt,
    scope: "operator_alert_readiness",
    scripts,
    alerts,
    runbook,
    structuredLogging,
    limitations: Object.freeze([
      "Does not prove a third-party monitoring vendor contract.",
      "Does not prove production host alert routing to humans.",
      "Does not authorize production deployment.",
    ]),
    verdict,
  });
}

function validateObservabilityCheckout(repoRoot) {
  const root = resolve(repoRoot);
  for (const relative of OBSERVABILITY_REQUIRED_SCRIPTS) {
    if (!existsSync(resolve(root, relative))) {
      return { ok: false, reason: `checkout missing required path ${relative}` };
    }
  }
  const operationsPath = resolve(root, "docs/OPERATIONS.md");
  let operations;
  try {
    operations = readFileSync(operationsPath, "utf8");
  } catch {
    return { ok: false, reason: "checkout missing docs/OPERATIONS.md" };
  }
  for (const needle of OBSERVABILITY_RUNBOOK_MENTIONS) {
    if (!operations.includes(needle)) {
      return { ok: false, reason: `runbook needle missing in checkout: ${needle}` };
    }
  }
  return { ok: true, reason: null };
}

export function validateObservabilityReadinessEvidence(evidence, options = {}) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (evidence.schemaVersion !== 1 || evidence.kind !== OBSERVABILITY_READINESS_KIND) {
    return { ok: false, reason: "unexpected schema or evidence kind" };
  }
  if (!checksumMatches(evidence)) {
    return { ok: false, reason: "evidence checksum mismatch" };
  }
  if (evidence?.verdict?.passed !== true) {
    return {
      ok: false,
      reason: `readiness verdict is not passed: ${JSON.stringify(evidence?.verdict?.failures ?? [])}`,
    };
  }
  if (!Array.isArray(evidence.verdict.failures) || evidence.verdict.failures.length !== 0) {
    return {
      ok: false,
      reason: "passing readiness verdict requires an explicit empty failures array",
    };
  }
  for (const relative of OBSERVABILITY_REQUIRED_SCRIPTS) {
    if (evidence?.scripts?.[relative] !== true) {
      return { ok: false, reason: `script proof missing for ${relative}` };
    }
  }
  for (const key of OBSERVABILITY_ALERT_ENV_KEYS) {
    if (evidence?.alerts?.[key] !== "configured") {
      return { ok: false, reason: `alert env not proven configured: ${key}` };
    }
  }
  for (const needle of OBSERVABILITY_RUNBOOK_MENTIONS) {
    if (evidence?.runbook?.[needle] !== true) {
      return { ok: false, reason: `runbook proof missing for ${needle}` };
    }
  }
  if (options.repoRoot) {
    const checkout = validateObservabilityCheckout(options.repoRoot);
    if (!checkout.ok) return checkout;
  }
  return { ok: true, reason: null };
}

export function evaluateObservabilityEvidenceResidual({
  artifactRoot = process.cwd(),
  relativePath = "artifacts/observability-readiness-evidence.json",
} = {}) {
  const path = resolve(artifactRoot, relativePath);
  if (!existsSync(path)) {
    return {
      status: "residual",
      reason: `Optional observability evidence absent (${relativePath}). Run pnpm observability:ready with alert thresholds configured.`,
    };
  }
  const body = readJson(path);
  const validated = validateObservabilityReadinessEvidence(body, { repoRoot: artifactRoot });
  if (!validated.ok) {
    return {
      status: "residual",
      reason: `Optional observability evidence invalid (${relativePath}: ${validated.reason}).`,
      present: [relativePath],
    };
  }
  return { status: "passed", reason: null, present: [relativePath] };
}

export function readObservabilityEvidenceFile(path) {
  if (!existsSync(path)) return null;
  return readJson(path);
}

function parseInstant(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
        reason: `${label} still contains a REPLACE_WITH_* placeholder; live drill is not complete`,
      };
    }
  }
  return null;
}

/** Operator readiness JSON must never close F03 / OPS-14 live routing proof. */
export function isObservabilityReadinessEvidence(evidence) {
  return evidence && typeof evidence === "object" && evidence.kind === OBSERVABILITY_READINESS_KIND;
}

/**
 * Validates live alert routing drill evidence (F03 / OPS-14).
 * Rejects observability-readiness payloads mis-submitted as live proof.
 * Rejects REPLACE_WITH_* leftovers even when verdict.passed is true.
 */
export function validateObservabilityLiveDrillEvidence(evidence, { now = Date.now() } = {}) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (isObservabilityReadinessEvidence(evidence)) {
    return {
      ok: false,
      reason:
        "observability-readiness evidence is not live alert routing proof (F03); record observability_live_drill instead",
    };
  }
  if (evidence.schemaVersion !== 1 || evidence.kind !== OBSERVABILITY_LIVE_DRILL_KIND) {
    return { ok: false, reason: "unexpected schema or evidence kind" };
  }
  if (!checksumMatches(evidence)) {
    return { ok: false, reason: "evidence checksum mismatch" };
  }
  if (evidence?.verdict?.passed !== true) {
    return {
      ok: false,
      reason: `live drill verdict is not passed: ${JSON.stringify(evidence?.verdict?.failures ?? [])}`,
    };
  }
  if (!Array.isArray(evidence.verdict.failures) || evidence.verdict.failures.length !== 0) {
    return {
      ok: false,
      reason: "passing live drill verdict requires an explicit empty failures array",
    };
  }
  if (!nonEmptyString(evidence?.owner?.name)) {
    return { ok: false, reason: "alert owner name is required" };
  }
  if (!nonEmptyString(evidence?.environment?.name)) {
    return { ok: false, reason: "target environment name is required" };
  }
  if (!nonEmptyString(evidence?.channel?.type) || !nonEmptyString(evidence?.channel?.route)) {
    return { ok: false, reason: "alert channel type and route are required" };
  }
  const placeholderReject = rejectReplaceWithFields([
    ["owner.name", evidence.owner.name],
    ["environment.name", evidence.environment.name],
    ["channel.type", evidence.channel.type],
    ["channel.route", evidence.channel.route],
    ["drill.signalName", evidence?.drill?.signalName],
  ]);
  if (placeholderReject) return placeholderReject;
  const thresholds = evidence?.thresholds;
  if (!thresholds || typeof thresholds !== "object" || Array.isArray(thresholds)) {
    return { ok: false, reason: "applicable alert thresholds object is required" };
  }
  if (Object.keys(thresholds).length === 0) {
    return { ok: false, reason: "thresholds must list the values exercised in the drill" };
  }
  const allowedThresholdKeys = new Set(OBSERVABILITY_LIVE_DRILL_THRESHOLD_KEYS);
  for (const [key, value] of Object.entries(thresholds)) {
    if (!nonEmptyString(key)) {
      return { ok: false, reason: "threshold keys must be non-empty" };
    }
    if (containsReplaceWithPlaceholder(key)) {
      return {
        ok: false,
        reason: `threshold key ${key} still contains a REPLACE_WITH_* placeholder`,
      };
    }
    if (!allowedThresholdKeys.has(key)) {
      return {
        ok: false,
        reason: `threshold key ${key} is not in the live-drill whitelist`,
      };
    }
    if (!validAlertThreshold(key, value)) {
      return { ok: false, reason: `threshold ${key} must be an integer within the worker limits` };
    }
  }
  const timeline = evidence?.timeline;
  const signalMs = parseInstant(timeline?.signalAt);
  const alertMs = parseInstant(timeline?.alertAt);
  const humanMs = parseInstant(timeline?.humanReceivedAt);
  const recoveryMs = parseInstant(timeline?.recoveryAt);
  if (
    signalMs === null ||
    alertMs === null ||
    humanMs === null ||
    recoveryMs === null ||
    signalMs > alertMs ||
    alertMs > humanMs ||
    humanMs > recoveryMs
  ) {
    return {
      ok: false,
      reason:
        "timeline requires signalAt → alertAt → humanReceivedAt → recoveryAt in chronological order",
    };
  }
  if (!Number.isFinite(now) || recoveryMs > now + CLOCK_SKEW_MS) {
    return { ok: false, reason: "live drill recovery is in the future" };
  }
  if (!nonEmptyString(evidence?.drill?.signalName)) {
    return { ok: false, reason: "drill.signalName must identify the injected or observed failure" };
  }
  if (!OBSERVABILITY_LIVE_DRILL_SIGNAL_NAMES.includes(evidence.drill.signalName)) {
    return {
      ok: false,
      reason: `drill.signalName ${evidence.drill.signalName} is not in the live-drill whitelist`,
    };
  }
  return { ok: true, reason: null };
}

export function buildObservabilityLiveDrillEvidenceTemplate({
  generatedAt = new Date().toISOString(),
} = {}) {
  return withObservabilityChecksum({
    schemaVersion: 1,
    kind: OBSERVABILITY_LIVE_DRILL_KIND,
    generatedAt,
    environment: { name: "REPLACE_WITH_TARGET_ENV" },
    owner: { name: "REPLACE_WITH_ONCALL_OWNER" },
    channel: { type: "REPLACE_WITH_CHANNEL_TYPE", route: "REPLACE_WITH_REDACTED_ROUTE" },
    thresholds: {
      WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: 80,
      WEB_PUSH_QUEUE_ALERT_DUE_JOBS: 100,
      WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: 900,
    },
    drill: { signalName: "REPLACE_WITH_SAFE_FAILURE_SIGNAL" },
    timeline: {
      signalAt: generatedAt,
      alertAt: generatedAt,
      humanReceivedAt: generatedAt,
      recoveryAt: generatedAt,
    },
    limitations: Object.freeze([
      "Template only; replace placeholders after a real live drill on the target environment.",
      "Does not authorize production deployment.",
    ]),
    verdict: Object.freeze({ passed: false, failures: Object.freeze(["template_not_executed"]) }),
  });
}
