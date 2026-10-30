import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const WEB_PUSH_SOAK_KIND = "web_push_production_duration_soak";
export const WEB_PUSH_PROVIDER_KIND = "web_push_live_provider_probe";

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

function forbiddenCapabilityKeys(value, pathParts = []) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      forbiddenCapabilityKeys(item, [...pathParts, String(index)]),
    );
  }
  const forbidden = new Set(["endpoint", "p256dh", "auth", "privateKey", "token"]);
  const hits = [];
  for (const [key, child] of Object.entries(value)) {
    const next = [...pathParts, key];
    if (forbidden.has(key)) hits.push(next.join("."));
    hits.push(...forbiddenCapabilityKeys(child, next));
  }
  return hits;
}

/** Pure validation of soak evidence body. Never invents PASS for incomplete payloads. */
export function validateWebPushSoakEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (evidence.schemaVersion !== 1 || evidence.kind !== WEB_PUSH_SOAK_KIND) {
    return { ok: false, reason: "unexpected schema or evidence kind" };
  }
  if (!checksumMatches(evidence)) {
    return { ok: false, reason: "evidence checksum mismatch" };
  }
  if (evidence?.verdict?.passed !== true) {
    return {
      ok: false,
      reason: `soak verdict is not passed: ${JSON.stringify(evidence?.verdict?.failures ?? [])}`,
    };
  }
  if (
    !Number.isSafeInteger(evidence?.fixture?.jobs) ||
    evidence.fixture.jobs < 1 ||
    evidence?.delivery?.acceptedUnique !== evidence.fixture.jobs ||
    evidence?.delivery?.duplicateAccepts !== 0 ||
    evidence?.queue?.finalFixturePending !== 0
  ) {
    return { ok: false, reason: "delivery/queue invariants are incomplete" };
  }
  if (evidence?.cleanup?.attempted !== true || evidence?.cleanup?.succeeded !== true) {
    return { ok: false, reason: "fixture cleanup was not proven" };
  }
  if (
    !Number.isSafeInteger(evidence?.timing?.durationActualMs) ||
    evidence.timing.durationActualMs < evidence?.timing?.durationTargetMs
  ) {
    return { ok: false, reason: "duration evidence is incomplete" };
  }
  return { ok: true, reason: null };
}

/** Pure validation of live provider probe evidence. Never invents PASS. */
export function validateWebPushProviderEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return { ok: false, reason: "missing or invalid evidence JSON" };
  }
  if (evidence.schemaVersion !== 1 || evidence.kind !== WEB_PUSH_PROVIDER_KIND) {
    return { ok: false, reason: "unexpected schema or evidence kind" };
  }
  if (!checksumMatches(evidence)) {
    return { ok: false, reason: "evidence checksum mismatch" };
  }
  const leaked = forbiddenCapabilityKeys(evidence);
  if (leaked.length) {
    return { ok: false, reason: `sensitive capability fields are present: ${leaked.join(", ")}` };
  }
  if (
    evidence?.verdict?.passed !== true ||
    !Number.isSafeInteger(evidence?.response?.statusCode) ||
    evidence.response.statusCode < 200 ||
    evidence.response.statusCode >= 300 ||
    evidence?.response?.errorClass !== null
  ) {
    return { ok: false, reason: "provider did not return an accepted 2xx response" };
  }
  if (
    typeof evidence?.target?.origin !== "string" ||
    !evidence.target.origin.startsWith("https://") ||
    !/^[a-f0-9]{64}$/u.test(evidence?.target?.endpointSha256 ?? "") ||
    !/^[a-f0-9]{64}$/u.test(evidence?.vapid?.publicKeySha256 ?? "")
  ) {
    return { ok: false, reason: "target/VAPID identity evidence is invalid" };
  }
  if (
    !Number.isSafeInteger(evidence?.response?.durationMs) ||
    evidence.response.durationMs < 0 ||
    evidence.response.durationMs > evidence?.request?.timeoutMs + 5_000
  ) {
    return { ok: false, reason: "provider timing evidence is invalid" };
  }
  return { ok: true, reason: null };
}

export function readWebPushEvidenceFile(path) {
  if (!existsSync(path)) return null;
  return readJson(path);
}

/**
 * Evaluate optional Web Push soak+provider residual for beta:candidate.
 * Presence alone never clears the residual; both artifacts must validate.
 */
export function evaluateWebPushEvidenceResidual({
  artifactRoot = process.cwd(),
  soakRelativePath = "artifacts/web-push-soak-evidence.json",
  providerRelativePath = "artifacts/web-push-provider-evidence.json",
} = {}) {
  const soakPath = resolve(artifactRoot, soakRelativePath);
  const providerPath = resolve(artifactRoot, providerRelativePath);
  const soakBody = readWebPushEvidenceFile(soakPath);
  const providerBody = readWebPushEvidenceFile(providerPath);
  const present = [];
  const problems = [];

  if (!soakBody) {
    problems.push(`${soakRelativePath}: absent`);
  } else {
    present.push(soakRelativePath);
    const soak = validateWebPushSoakEvidence(soakBody);
    if (!soak.ok) problems.push(`${soakRelativePath}: ${soak.reason}`);
  }

  if (!providerBody) {
    problems.push(`${providerRelativePath}: absent`);
  } else {
    present.push(providerRelativePath);
    const provider = validateWebPushProviderEvidence(providerBody);
    if (!provider.ok) problems.push(`${providerRelativePath}: ${provider.reason}`);
  }

  if (!problems.length) {
    return { status: "passed", reason: null, present };
  }

  return {
    status: "residual",
    reason: `Optional Web Push evidence incomplete or invalid (${problems.join("; ")}).`,
    ...(present.length ? { present } : {}),
  };
}
