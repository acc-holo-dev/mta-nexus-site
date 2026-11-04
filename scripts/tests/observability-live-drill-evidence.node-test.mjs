import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildObservabilityReadinessEvidence,
  OBSERVABILITY_LIVE_DRILL_KIND,
  validateObservabilityLiveDrillEvidence,
} from "../observability-evidence-lib.mjs";

function withChecksum(core) {
  return {
    ...core,
    evidenceSha256: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
}

function fixture(name) {
  return JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures", name), "utf8"));
}

function liveDrill(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: OBSERVABILITY_LIVE_DRILL_KIND,
    generatedAt: "2026-11-04T12:00:00.000Z",
    environment: { name: "staging-primary" },
    owner: { name: "platform-oncall" },
    channel: { type: "pager", route: "team-platform-escalation" },
    thresholds: {
      WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: 80,
      WEB_PUSH_QUEUE_ALERT_DUE_JOBS: 100,
      WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: 900,
    },
    drill: { signalName: "publication_delivery_failed" },
    timeline: {
      signalAt: "2026-11-04T12:00:00.000Z",
      alertAt: "2026-11-04T12:00:45.000Z",
      humanReceivedAt: "2026-11-04T12:02:10.000Z",
      recoveryAt: "2026-11-04T12:18:00.000Z",
    },
    verdict: { passed: true, failures: [] },
    ...overrides,
  };
  return withChecksum(core);
}

test("fixture accept: observability-live-drill-accept.json validates", () => {
  const body = fixture("observability-live-drill-accept.json");
  assert.equal(validateObservabilityLiveDrillEvidence(body).ok, true);
});

test("fixture reject: readiness evidence is not F03 live proof", () => {
  const readiness = buildObservabilityReadinessEvidence({
    repoRoot: process.cwd(),
    env: {
      WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: "80",
      WEB_PUSH_QUEUE_ALERT_DUE_JOBS: "100",
      WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: "900",
    },
  });
  const result = validateObservabilityLiveDrillEvidence(readiness);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /observability-readiness/u);
});

test("live drill validator rejects broken timeline and failed verdict", () => {
  assert.equal(validateObservabilityLiveDrillEvidence(liveDrill()).ok, true);
  assert.equal(
    validateObservabilityLiveDrillEvidence(
      liveDrill({
        timeline: {
          signalAt: "2026-11-04T12:05:00.000Z",
          alertAt: "2026-11-04T12:00:00.000Z",
          humanReceivedAt: "2026-11-04T12:02:00.000Z",
          recoveryAt: "2026-11-04T12:10:00.000Z",
        },
      }),
    ).ok,
    false,
  );
  assert.equal(
    validateObservabilityLiveDrillEvidence(
      liveDrill({ verdict: { passed: false, failures: ["no_human_ack"] } }),
    ).ok,
    false,
  );
});
