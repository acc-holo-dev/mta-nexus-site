#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const path = resolve(process.cwd(), process.argv[2] || "artifacts/web-push-provider-evidence.json");

function fail(message) {
  process.stderr.write(`web-push-provider-evidence: ${message}\n`);
  process.exitCode = 1;
}

function forbiddenKeys(value, pathParts = []) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => forbiddenKeys(item, [...pathParts, String(index)]));
  }

  const forbidden = new Set(["endpoint", "p256dh", "auth", "privateKey", "token"]);
  const hits = [];
  for (const [key, child] of Object.entries(value)) {
    const next = [...pathParts, key];
    if (forbidden.has(key)) hits.push(next.join("."));
    hits.push(...forbiddenKeys(child, next));
  }
  return hits;
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(path, "utf8"));
} catch {
  fail("missing or invalid evidence JSON");
  process.exit();
}

if (evidence?.schemaVersion !== 1 || evidence?.kind !== "web_push_live_provider_probe") {
  fail("unexpected schema or evidence kind");
  process.exit();
}

const { evidenceSha256, ...core } = evidence;
const expected = createHash("sha256").update(JSON.stringify(core)).digest("hex");
if (typeof evidenceSha256 !== "string" || evidenceSha256 !== expected) {
  fail("evidence checksum mismatch");
}

const leaked = forbiddenKeys(evidence);
if (leaked.length) {
  fail(`sensitive capability fields are present: ${leaked.join(", ")}`);
}

if (
  evidence?.verdict?.passed !== true ||
  !Number.isSafeInteger(evidence?.response?.statusCode) ||
  evidence.response.statusCode < 200 ||
  evidence.response.statusCode >= 300 ||
  evidence?.response?.errorClass !== null
) {
  fail("provider did not return an accepted 2xx response");
}

if (
  typeof evidence?.target?.origin !== "string" ||
  !evidence.target.origin.startsWith("https://") ||
  !/^[a-f0-9]{64}$/u.test(evidence?.target?.endpointSha256 ?? "") ||
  !/^[a-f0-9]{64}$/u.test(evidence?.vapid?.publicKeySha256 ?? "")
) {
  fail("target/VAPID identity evidence is invalid");
}

if (
  !Number.isSafeInteger(evidence?.response?.durationMs) ||
  evidence.response.durationMs < 0 ||
  evidence.response.durationMs > evidence?.request?.timeoutMs + 5_000
) {
  fail("provider timing evidence is invalid");
}

if (!process.exitCode) {
  process.stdout.write(
    `web-push-provider-evidence: passed provider=${evidence.target.origin} http=${evidence.response.statusCode}\n`,
  );
}
