import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  isValidWebPushAuthSecret,
  isValidWebPushP256PublicKey,
  readWebPushVapidConfig,
} from "@nexus/config";
import {
  WebPushPermanentPayloadError,
  WebPushPermanentSubscriptionError,
  createWebPushHttpSender,
  parseWebPushEndpoint,
} from "../src/web-push-runtime";

if (process.env.NEXUS_WEB_PUSH_PROVIDER_PROBE_ACK !== "YES") {
  throw new Error("Refusing live Web Push probe without NEXUS_WEB_PUSH_PROVIDER_PROBE_ACK=YES");
}

const endpoint = process.env.NEXUS_WEB_PUSH_PROBE_ENDPOINT?.trim() ?? "";
const p256dh = process.env.NEXUS_WEB_PUSH_PROBE_P256DH?.trim() ?? "";
const auth = process.env.NEXUS_WEB_PUSH_PROBE_AUTH?.trim() ?? "";
const timeoutMs = Number(process.env.NEXUS_WEB_PUSH_PROBE_TIMEOUT_MS ?? "15000");

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 60_000) {
  throw new RangeError("NEXUS_WEB_PUSH_PROBE_TIMEOUT_MS must be between 250 and 60000");
}
if (!isValidWebPushP256PublicKey(p256dh)) {
  throw new Error("Invalid live probe p256dh key");
}
if (!isValidWebPushAuthSecret(auth)) {
  throw new Error("Invalid live probe auth secret");
}

const target = parseWebPushEndpoint(endpoint);
const vapid = readWebPushVapidConfig();
if (!vapid) {
  throw new Error("Web Push VAPID configuration is required");
}

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../../..");
const evidencePath = resolve(
  repositoryRoot,
  process.env.NEXUS_WEB_PUSH_PROVIDER_EVIDENCE_PATH?.trim() ||
    "artifacts/web-push-provider-evidence.json",
);

async function writeEvidence(value: unknown) {
  await mkdir(dirname(evidencePath), { recursive: true });
  const temporary = `${evidencePath}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, evidencePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function failureClass(error: unknown): string {
  if (error instanceof WebPushPermanentSubscriptionError) {
    return "permanent_subscription";
  }
  if (error instanceof WebPushPermanentPayloadError) {
    return "permanent_payload";
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout_or_abort";
  }
  return "transport_or_provider";
}

const probeId = randomBytes(12).toString("base64url");
const sender = createWebPushHttpSender(vapid, {
  timeoutMs,
  ttlSeconds: 60,
});
const startedAt = Date.now();

let statusCode: number | null = null;
let retryAfterMs: number | null = null;
let errorClass: string | null = null;

try {
  const result = await sender(
    { endpoint, p256dh, auth },
    {
      title: "MTA NEXUS Web Push live probe",
      body: "External provider acceptance probe.",
      url: "/notifications",
      tag: `provider-probe-${probeId}`,
    },
  );
  statusCode = result.statusCode;
  retryAfterMs = result.retryAfterMs ?? null;
} catch (error) {
  errorClass = failureClass(error);
}

const completedAt = Date.now();
const passed = errorClass === null && statusCode !== null && statusCode >= 200 && statusCode < 300;

const evidenceCore = {
  schemaVersion: 1,
  kind: "web_push_live_provider_probe",
  generatedAt: new Date().toISOString(),
  target: {
    origin: target.origin,
    endpointSha256: createHash("sha256").update(endpoint, "utf8").digest("hex"),
  },
  vapid: {
    publicKeySha256: createHash("sha256").update(vapid.publicKey, "utf8").digest("hex"),
    subjectScheme: vapid.subject.startsWith("mailto:") ? "mailto" : "https",
  },
  request: {
    timeoutMs,
    ttlSeconds: 60,
  },
  response: {
    statusCode,
    retryAfterMs,
    errorClass,
    durationMs: completedAt - startedAt,
  },
  verdict: {
    passed,
    failures: passed ? [] : [errorClass ?? `provider_status_${statusCode ?? "unknown"}`],
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
};
const evidenceSha256 = createHash("sha256").update(JSON.stringify(evidenceCore)).digest("hex");
await writeEvidence({
  ...evidenceCore,
  evidenceSha256,
});

process.stdout.write(
  `web-push-provider-probe status=${passed ? "passed" : "failed"} provider=${target.origin} http=${statusCode ?? "none"} evidence=${evidencePath}\n`,
);
if (!passed) process.exitCode = 1;
