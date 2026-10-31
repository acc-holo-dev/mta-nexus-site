import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const OBSERVABILITY_READINESS_KIND = "observability_operator_readiness";

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
    const configured = raw !== "" && Number.isFinite(value) && value > 0;
    alerts[key] = configured ? "configured" : "missing";
    if (!configured) failures.push(`alert_env:${key}`);
  }

  const operations = readFileSync(resolve(repoRoot, "docs/OPERATIONS.md"), "utf8");
  const runbookMentions = [
    "report_delivery_failed",
    "support_delivery_failed",
    "verification_delivery_failed",
    "discussion_delivery_failed",
    "check-web-push-worker-queue",
  ];
  const runbook = {};
  for (const needle of runbookMentions) {
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

export function validateObservabilityReadinessEvidence(evidence) {
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
  const validated = validateObservabilityReadinessEvidence(body);
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
