import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BACKUP_RESTORE_EVIDENCE_FLAGS } from "../backup-restore-contract.mjs";
import {
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
  assert.equal(validateProductionRecoveryAcceptanceEvidence(body).ok, true);
});

test("fixture reject: CI backup-restore PASS is not F04 acceptance", () => {
  const ciPass = fixture("backup-restore-ci-pass-reject-as-f04.json");
  assert.equal(isDisposableBackupRestoreRehearsalEvidence(ciPass), true);
  const result = validateProductionRecoveryAcceptanceEvidence(ciPass);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /disposable backup-restore/u);
});

test("acceptance validator rejects missing owner targets and out-of-band restore", () => {
  assert.equal(validateProductionRecoveryAcceptanceEvidence(acceptance()).ok, true);
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
