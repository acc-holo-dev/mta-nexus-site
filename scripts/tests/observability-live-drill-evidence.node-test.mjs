import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildObservabilityLiveDrillEvidenceTemplate,
  buildObservabilityReadinessEvidence,
  containsReplaceWithPlaceholder,
  OBSERVABILITY_LIVE_DRILL_KIND,
  OBSERVABILITY_LIVE_DRILL_SIGNAL_NAMES,
  OBSERVABILITY_LIVE_DRILL_THRESHOLD_KEYS,
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

const fixtureNow = Date.parse("2026-11-05T00:00:00.000Z");

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
  assert.equal(validateObservabilityLiveDrillEvidence(body, { now: fixtureNow }).ok, true);
});

test("live drill rejects missing, malformed or contradictory failures", () => {
  for (const verdict of [
    { passed: true },
    { passed: true, failures: null },
    { passed: true, failures: "" },
    { passed: true, failures: ["delivery_failed"] },
  ]) {
    const result = validateObservabilityLiveDrillEvidence(liveDrill({ verdict }), {
      now: fixtureNow,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /explicit empty failures array/u);
  }
});

test("live drill threshold values obey the worker's integer bounds", () => {
  for (const [key, max] of [
    ["WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT", 99],
    ["WEB_PUSH_QUEUE_ALERT_DUE_JOBS", 50_000],
    ["WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS", 86_400],
  ]) {
    for (const value of [1, max]) {
      assert.equal(
        validateObservabilityLiveDrillEvidence(liveDrill({ thresholds: { [key]: value } }), {
          now: fixtureNow,
        }).ok,
        true,
        `${key}=${value}`,
      );
    }
    for (const value of [0, max + 1, 1.5, "1", Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(
        validateObservabilityLiveDrillEvidence(liveDrill({ thresholds: { [key]: value } }), {
          now: fixtureNow,
        }).ok,
        false,
        `${key}=${value}`,
      );
    }
  }
});

test("accepts old and clock-skewed live drills but rejects a future drill", () => {
  const now = Date.parse("2030-01-01T00:00:00.000Z");
  assert.equal(validateObservabilityLiveDrillEvidence(liveDrill(), { now }).ok, true);
  const at = (ms) =>
    liveDrill({
      timeline: {
        signalAt: new Date(ms - 60_000).toISOString(),
        alertAt: new Date(ms - 40_000).toISOString(),
        humanReceivedAt: new Date(ms - 20_000).toISOString(),
        recoveryAt: new Date(ms).toISOString(),
      },
    });
  assert.equal(validateObservabilityLiveDrillEvidence(at(now + 300_000), { now }).ok, true);
  const future = validateObservabilityLiveDrillEvidence(at(now + 300_001), { now });
  assert.equal(future.ok, false);
  assert.match(future.reason, /future/u);
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

test("fixture reject: REPLACE_WITH_* leftovers fail even when verdict.passed", () => {
  const body = fixture("observability-live-drill-reject-placeholders.json");
  assert.equal(body.verdict.passed, true);
  assert.equal(containsReplaceWithPlaceholder(body.owner.name), true);
  const result = validateObservabilityLiveDrillEvidence(body);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /REPLACE_WITH_\*/u);
});

test("fixture reject: unknown drill.signalName is not whitelisted", () => {
  const body = fixture("observability-live-drill-reject-unknown-signal.json");
  assert.equal(body.verdict.passed, true);
  const result = validateObservabilityLiveDrillEvidence(body);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /not in the live-drill whitelist/u);
});

test("fixture reject: unknown threshold key is not whitelisted", () => {
  const body = fixture("observability-live-drill-reject-unknown-threshold.json");
  assert.equal(body.verdict.passed, true);
  const result = validateObservabilityLiveDrillEvidence(body);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /threshold key MADE_UP_ALERT_THRESHOLD/u);
});

test("live drill validator rejects broken timeline and failed verdict", () => {
  assert.equal(validateObservabilityLiveDrillEvidence(liveDrill(), { now: fixtureNow }).ok, true);
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

test("live drill validator rejects owner REPLACE_WITH_* with passed verdict", () => {
  const result = validateObservabilityLiveDrillEvidence(
    liveDrill({ owner: { name: "REPLACE_WITH_ONCALL_OWNER" } }),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /owner\.name.*REPLACE_WITH_\*/u);
});

test("live drill validator enforces signalName and threshold key whitelists", () => {
  assert.ok(OBSERVABILITY_LIVE_DRILL_SIGNAL_NAMES.includes("publication_delivery_failed"));
  assert.ok(OBSERVABILITY_LIVE_DRILL_THRESHOLD_KEYS.includes("WEB_PUSH_QUEUE_ALERT_DUE_JOBS"));
  assert.equal(
    validateObservabilityLiveDrillEvidence(
      liveDrill({ drill: { signalName: "not_a_known_signal" } }),
    ).ok,
    false,
  );
  assert.equal(
    validateObservabilityLiveDrillEvidence(
      liveDrill({
        thresholds: {
          WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: 80,
          UNKNOWN_THRESHOLD_KEY: 1,
        },
      }),
    ).ok,
    false,
  );
});

test("live drill template stays rejected (template_not_executed + placeholders)", () => {
  const template = buildObservabilityLiveDrillEvidenceTemplate({
    generatedAt: "2026-11-04T12:00:00.000Z",
  });
  assert.equal(template.verdict.passed, false);
  assert.equal(validateObservabilityLiveDrillEvidence(template).ok, false);

  const forged = withChecksum({
    schemaVersion: template.schemaVersion,
    kind: template.kind,
    generatedAt: template.generatedAt,
    environment: template.environment,
    owner: template.owner,
    channel: template.channel,
    thresholds: template.thresholds,
    drill: template.drill,
    timeline: template.timeline,
    limitations: template.limitations,
    verdict: { passed: true, failures: [] },
  });
  const result = validateObservabilityLiveDrillEvidence(forged);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /REPLACE_WITH_\*/u);
});
