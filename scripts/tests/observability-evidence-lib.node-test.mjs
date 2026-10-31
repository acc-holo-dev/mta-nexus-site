import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildObservabilityReadinessEvidence,
  evaluateObservabilityEvidenceResidual,
  validateObservabilityReadinessEvidence,
} from "../observability-evidence-lib.mjs";

const alertEnv = {
  WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: "80",
  WEB_PUSH_QUEUE_ALERT_DUE_JOBS: "100",
  WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: "900",
};

test("buildObservabilityReadinessEvidence passes on this repo with alert env", () => {
  const evidence = buildObservabilityReadinessEvidence({
    repoRoot: process.cwd(),
    env: alertEnv,
  });
  assert.equal(evidence.verdict.passed, true);
  assert.equal(validateObservabilityReadinessEvidence(evidence).ok, true);
});

test("evaluateObservabilityEvidenceResidual stays residual without inventing PASS for absence", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-evidence-"));
  try {
    const result = evaluateObservabilityEvidenceResidual({ artifactRoot: dir });
    assert.equal(result.status, "residual");
    assert.match(result.reason ?? "", /absent/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateObservabilityEvidenceResidual passes only for validated evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-evidence-ok-"));
  try {
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    const evidence = buildObservabilityReadinessEvidence({
      repoRoot: process.cwd(),
      env: alertEnv,
    });
    writeFileSync(
      join(dir, "artifacts/observability-readiness-evidence.json"),
      `${JSON.stringify(evidence, null, 2)}\n`,
    );
    const result = evaluateObservabilityEvidenceResidual({ artifactRoot: dir });
    assert.equal(result.status, "passed");
    assert.equal(result.reason, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
