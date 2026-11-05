import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BACKUP_RESTORE_EVIDENCE_FLAGS } from "../backup-restore-contract.mjs";
import {
  buildProductionRecoveryAcceptanceEvidenceTemplate,
  containsReplaceWithPlaceholder,
  isDisposableBackupRestoreRehearsalEvidence,
  PRODUCTION_RECOVERY_ACCEPTANCE_KIND,
  validateProductionRecoveryAcceptanceEvidence,
} from "../production-recovery-acceptance-evidence.mjs";

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

function acceptance(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: PRODUCTION_RECOVERY_ACCEPTANCE_KIND,
    generatedAt: "2026-11-04T12:00:00.000Z",
    environment: { name: "production-primary" },
    owner: { name: "infra-lead" },
    targets: { rpoMinutes: 60, rtoMinutes: 240 },
    retention: {
      policy: "Daily DB + uploads; 30-day rolling off-host",
      offHostLocation: "Provider bucket in separate region/account",
      offHostVerified: true,
    },
    access: {
      restoreRoles: "infra-lead + break-glass backup operator",
      breakGlassProcedure: "Documented in private runbook section R-04",
    },
    measuredRestore: {
      startedAt: "2026-11-04T08:00:00.000Z",
      completedAt: "2026-11-04T09:45:00.000Z",
      dataLossMinutes: 15,
      withinRpo: true,
      withinRto: true,
    },
    verdict: { passed: true, failures: [] },
    ...overrides,
  };
  return withChecksum(core);
}

test("fixture accept: production-recovery-acceptance-accept.json validates", () => {
  const body = fixture("production-recovery-acceptance-accept.json");
  assert.equal(validateProductionRecoveryAcceptanceEvidence(body, { now: fixtureNow }).ok, true);
});

test("acceptance requires an explicit, empty failures list for a passing verdict", () => {
  for (const verdict of [
    { passed: true },
    { passed: true, failures: null },
    { passed: true, failures: "" },
    { passed: true, failures: ["restore_failed"] },
  ]) {
    const result = validateProductionRecoveryAcceptanceEvidence(acceptance({ verdict }), {
      now: fixtureNow,
    });
    assert.equal(result.ok, false);
    assert.match(result.reason, /explicit empty failures array/u);
  }
  assert.equal(
    validateProductionRecoveryAcceptanceEvidence(acceptance(), { now: fixtureNow }).ok,
    true,
  );
});

test("accepts old and clock-skewed restore evidence but rejects a future drill", () => {
  const now = Date.parse("2030-01-01T00:00:00.000Z");
  assert.equal(validateProductionRecoveryAcceptanceEvidence(acceptance(), { now }).ok, true);
  const at = (ms) =>
    acceptance({
      measuredRestore: {
        startedAt: new Date(ms - 60_000).toISOString(),
        completedAt: new Date(ms).toISOString(),
        dataLossMinutes: 15,
        withinRpo: true,
        withinRto: true,
      },
    });
  assert.equal(validateProductionRecoveryAcceptanceEvidence(at(now + 300_000), { now }).ok, true);
  const future = validateProductionRecoveryAcceptanceEvidence(at(now + 300_001), { now });
  assert.equal(future.ok, false);
  assert.match(future.reason, /future/u);
});

test("fixture reject: CI backup-restore PASS is not F04 acceptance", () => {
  const ciPass = fixture("backup-restore-ci-pass-reject-as-f04.json");
  assert.equal(isDisposableBackupRestoreRehearsalEvidence(ciPass), true);
  const result = validateProductionRecoveryAcceptanceEvidence(ciPass);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /disposable backup-restore/u);
});

test("fixture reject: REPLACE_WITH_* leftovers fail even when verdict.passed", () => {
  const body = fixture("production-recovery-acceptance-reject-placeholders.json");
  assert.equal(body.verdict.passed, true);
  assert.equal(containsReplaceWithPlaceholder(body.owner.name), true);
  const result = validateProductionRecoveryAcceptanceEvidence(body);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /REPLACE_WITH_\*/u);
});

test("acceptance validator rejects missing owner targets and out-of-band restore", () => {
  assert.equal(
    validateProductionRecoveryAcceptanceEvidence(acceptance(), { now: fixtureNow }).ok,
    true,
  );
  assert.equal(
    validateProductionRecoveryAcceptanceEvidence(
      acceptance({
        measuredRestore: {
          startedAt: "2026-11-04T08:00:00.000Z",
          completedAt: "2026-11-04T13:00:00.000Z",
          dataLossMinutes: 15,
          withinRpo: true,
          withinRto: false,
        },
      }),
    ).ok,
    false,
  );
  const disposablePass = withChecksum({
    status: "PASS",
    sha: "abc123",
    ...Object.fromEntries(BACKUP_RESTORE_EVIDENCE_FLAGS.map((flag) => [flag, true])),
  });
  assert.equal(validateProductionRecoveryAcceptanceEvidence(disposablePass).ok, false);
});

test("acceptance validator rejects owner REPLACE_WITH_* with passed verdict", () => {
  const result = validateProductionRecoveryAcceptanceEvidence(
    acceptance({ owner: { name: "REPLACE_WITH_ACCEPTANCE_OWNER" } }),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /owner\.name.*REPLACE_WITH_\*/u);
});

test("acceptance validator rejects retention and access REPLACE_WITH_* leftovers", () => {
  assert.equal(
    validateProductionRecoveryAcceptanceEvidence(
      acceptance({
        retention: {
          policy: "REPLACE_WITH_RETENTION_POLICY",
          offHostLocation: "Provider bucket in separate region/account",
          offHostVerified: true,
        },
      }),
    ).ok,
    false,
  );
  assert.equal(
    validateProductionRecoveryAcceptanceEvidence(
      acceptance({
        access: {
          restoreRoles: "infra-lead + break-glass backup operator",
          breakGlassProcedure: "REPLACE_WITH_BREAK_GLASS_PROCEDURE",
        },
      }),
    ).ok,
    false,
  );
});

test("acceptance template stays rejected (template_not_executed + placeholders)", () => {
  const template = buildProductionRecoveryAcceptanceEvidenceTemplate({
    generatedAt: "2026-11-04T12:00:00.000Z",
  });
  assert.equal(template.verdict.passed, false);
  assert.equal(template.retention.offHostVerified, false);
  assert.equal(validateProductionRecoveryAcceptanceEvidence(template).ok, false);

  const forged = withChecksum({
    schemaVersion: template.schemaVersion,
    kind: template.kind,
    generatedAt: template.generatedAt,
    environment: template.environment,
    owner: template.owner,
    targets: template.targets,
    retention: { ...template.retention, offHostVerified: true },
    access: template.access,
    measuredRestore: {
      startedAt: "2026-11-04T08:00:00.000Z",
      completedAt: "2026-11-04T09:45:00.000Z",
      dataLossMinutes: 15,
      withinRpo: true,
      withinRto: true,
    },
    limitations: template.limitations,
    verdict: { passed: true, failures: [] },
  });
  const result = validateProductionRecoveryAcceptanceEvidence(forged);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /REPLACE_WITH_\*/u);
});
