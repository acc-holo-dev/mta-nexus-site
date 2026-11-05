import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateWebPushEvidenceResidual,
  validateWebPushProviderEvidence,
  validateWebPushSoakEvidence,
} from "../web-push-evidence-lib.mjs";

function withChecksum(core) {
  return {
    ...core,
    evidenceSha256: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
}

function soak(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: "web_push_production_duration_soak",
    generatedAt: "2026-10-08T00:00:00.000Z",
    fixture: { namespace: "fixture", notifications: 10, subscriptions: 2, jobs: 20, waves: 5 },
    configuration: { durationMs: 60_000 },
    timing: { durationTargetMs: 60_000, durationActualMs: 60_100, drainMs: 5_000 },
    delivery: {
      acceptedUnique: 20,
      duplicateAccepts: 0,
      forcedRetries: 1,
      dispatcher: { retried: 1, unsettled: 0, discarded: 0, stale: 0 },
    },
    queue: { finalFixturePending: 0, maxFixturePending: 20, capacity: 100 },
    verdict: { passed: true, failures: [] },
    cleanup: { attempted: true, succeeded: true },
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    ...overrides,
  };
  return withChecksum(core);
}

function provider(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: "web_push_live_provider_probe",
    generatedAt: "2026-10-08T00:00:00.000Z",
    target: {
      origin: "https://fcm.googleapis.com",
      endpointSha256: "a".repeat(64),
    },
    vapid: { publicKeySha256: "b".repeat(64) },
    request: { timeoutMs: 15_000 },
    response: { statusCode: 201, durationMs: 120, errorClass: null },
    verdict: { passed: true, failures: [] },
    ...overrides,
  };
  return withChecksum(core);
}

test("soak validator rejects failed verdicts and never invents PASS", () => {
  assert.equal(validateWebPushSoakEvidence(soak()).ok, true);
  assert.equal(
    validateWebPushSoakEvidence(
      soak({
        verdict: { passed: false, failures: ["fixture_queue_not_drained"] },
      }),
    ).ok,
    false,
  );
  assert.equal(validateWebPushSoakEvidence(null).ok, false);
});

test("provider validator rejects capability leaks and non-2xx responses", () => {
  assert.equal(validateWebPushProviderEvidence(provider()).ok, true);
  const leaked = {
    schemaVersion: 1,
    kind: "web_push_live_provider_probe",
    generatedAt: "2026-10-08T00:00:00.000Z",
    target: {
      origin: "https://fcm.googleapis.com",
      endpointSha256: "a".repeat(64),
    },
    vapid: { publicKeySha256: "b".repeat(64) },
    request: { timeoutMs: 15_000 },
    response: { statusCode: 201, durationMs: 120, errorClass: null },
    verdict: { passed: true, failures: [] },
    endpoint: "https://secret.example/push",
  };
  assert.equal(validateWebPushProviderEvidence(withChecksum(leaked)).ok, false);
  assert.equal(
    validateWebPushProviderEvidence(
      provider({
        response: { statusCode: 410, durationMs: 40, errorClass: "permanent_subscription" },
        verdict: { passed: false, failures: ["gone"] },
      }),
    ).ok,
    false,
  );
});

test("soak evidence requires a bounded configured target and a complete duration", () => {
  for (const target of [
    undefined,
    null,
    "60000",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    60_000.5,
    59_999,
    21_600_001,
  ]) {
    assert.equal(
      validateWebPushSoakEvidence(
        soak({ timing: { durationTargetMs: target, durationActualMs: 60_100 } }),
      ).ok,
      false,
    );
  }
  assert.equal(
    validateWebPushSoakEvidence(soak({ configuration: { durationMs: 120_000 } })).ok,
    false,
  );
  assert.equal(
    validateWebPushSoakEvidence(
      soak({ timing: { durationTargetMs: 60_000, durationActualMs: 59_999 } }),
    ).ok,
    false,
  );
  for (const durationActualMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(
      validateWebPushSoakEvidence(soak({ timing: { durationTargetMs: 60_000, durationActualMs } }))
        .ok,
      false,
    );
  }
  assert.equal(
    validateWebPushSoakEvidence(
      soak({
        configuration: { durationMs: 21_600_000 },
        timing: { durationTargetMs: 21_600_000, durationActualMs: 21_600_100 },
      }),
    ).ok,
    true,
  );
});

test("soak evidence must prove retry, drain and capacity invariants", () => {
  const base = {
    acceptedUnique: 20,
    duplicateAccepts: 0,
    forcedRetries: 1,
    dispatcher: { retried: 1, unsettled: 0, discarded: 0, stale: 0 },
  };
  for (const delivery of [
    { ...base, forcedRetries: 0 },
    { ...base, forcedRetries: undefined },
    { ...base, dispatcher: { ...base.dispatcher, retried: 0 } },
    { ...base, dispatcher: { ...base.dispatcher, unsettled: 1 } },
    { ...base, dispatcher: { ...base.dispatcher, discarded: 1 } },
    { ...base, dispatcher: { ...base.dispatcher, stale: 1 } },
  ])
    assert.equal(validateWebPushSoakEvidence(soak({ delivery })).ok, false);
  for (const queue of [
    { finalFixturePending: 0 },
    { finalFixturePending: 0, capacity: 0, maxFixturePending: 0 },
    { finalFixturePending: 0, capacity: 10, maxFixturePending: 11 },
  ])
    assert.equal(validateWebPushSoakEvidence(soak({ queue })).ok, false);
  assert.equal(
    validateWebPushSoakEvidence(
      soak({ verdict: { passed: true, failures: ["retry_path_not_exercised"] } }),
    ).ok,
    false,
  );
});

test("provider evidence requires the actual bounded request timeout", () => {
  for (const timeoutMs of [
    undefined,
    null,
    "15000",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    250.5,
    249,
    60_001,
  ]) {
    assert.equal(validateWebPushProviderEvidence(provider({ request: { timeoutMs } })).ok, false);
  }
  for (const durationMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(
      validateWebPushProviderEvidence(
        provider({ response: { statusCode: 201, durationMs, errorClass: null } }),
      ).ok,
      false,
    );
  }
  assert.equal(validateWebPushProviderEvidence(provider({ request: undefined })).ok, false);
  assert.equal(
    validateWebPushProviderEvidence(
      provider({
        request: { timeoutMs: 250 },
        response: { statusCode: 201, durationMs: 5_251, errorClass: null },
      }),
    ).ok,
    false,
  );
  assert.equal(validateWebPushProviderEvidence(provider({ request: { timeoutMs: 250 } })).ok, true);
  assert.equal(
    validateWebPushProviderEvidence(provider({ request: { timeoutMs: 60_000 } })).ok,
    true,
  );
  assert.equal(
    validateWebPushProviderEvidence(
      provider({ verdict: { passed: true, failures: ["provider_status_503"] } }),
    ).ok,
    false,
  );
});

test("beta residual requires both validated artifacts; presence alone never passes", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-push-evidence-"));
  const artifacts = join(directory, "artifacts");
  mkdirSync(artifacts, { recursive: true });
  try {
    assert.equal(evaluateWebPushEvidenceResidual({ artifactRoot: directory }).status, "residual");

    writeFileSync(join(artifacts, "web-push-soak-evidence.json"), `${JSON.stringify(soak())}\n`);
    const soakOnly = evaluateWebPushEvidenceResidual({ artifactRoot: directory });
    assert.equal(soakOnly.status, "residual");
    assert.match(soakOnly.reason, /provider-evidence\.json: absent/u);

    writeFileSync(
      join(artifacts, "web-push-provider-evidence.json"),
      `${JSON.stringify({ schemaVersion: 1, kind: "web_push_live_provider_probe", verdict: { passed: true } })}\n`,
    );
    const invalidProvider = evaluateWebPushEvidenceResidual({ artifactRoot: directory });
    assert.equal(invalidProvider.status, "residual");
    assert.match(invalidProvider.reason, /provider-evidence\.json:/u);
    assert.equal(invalidProvider.status === "passed", false);

    writeFileSync(
      join(artifacts, "web-push-provider-evidence.json"),
      `${JSON.stringify(provider())}\n`,
    );
    const both = evaluateWebPushEvidenceResidual({ artifactRoot: directory });
    assert.equal(both.status, "passed");
    assert.equal(both.reason, null);
    assert.deepEqual(both.present, [
      "artifacts/web-push-soak-evidence.json",
      "artifacts/web-push-provider-evidence.json",
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
