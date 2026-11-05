import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  buildObservabilityReadinessEvidence,
  evaluateObservabilityEvidenceResidual,
  OBSERVABILITY_REQUIRED_SCRIPTS,
  OBSERVABILITY_RUNBOOK_MENTIONS,
  validateObservabilityReadinessEvidence,
  withObservabilityChecksum,
} from "../observability-evidence-lib.mjs";

const alertEnv = {
  WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT: "80",
  WEB_PUSH_QUEUE_ALERT_DUE_JOBS: "100",
  WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS: "900",
};

function operationsWithNeedles(needles = OBSERVABILITY_RUNBOOK_MENTIONS) {
  return `# operator runbook stubs\n${needles.join("\n")}\n`;
}

function writeMinimalCheckout(repoRoot, { operationsBody = operationsWithNeedles() } = {}) {
  for (const relative of OBSERVABILITY_REQUIRED_SCRIPTS) {
    const absolute = join(repoRoot, relative);
    mkdirSync(dirname(absolute), { recursive: true });
    if (relative === "docs/OPERATIONS.md") {
      writeFileSync(absolute, operationsBody);
    } else if (relative.endsWith(".ts")) {
      writeFileSync(absolute, "export const structuredLogging = true;\n");
    } else {
      writeFileSync(absolute, "#!/usr/bin/env node\n");
    }
  }
}

test("buildObservabilityReadinessEvidence passes on this repo with alert env", () => {
  const evidence = buildObservabilityReadinessEvidence({
    repoRoot: process.cwd(),
    env: alertEnv,
  });
  assert.equal(evidence.verdict.passed, true);
  for (const needle of ["publication_delivery_failed", "build_incident_delivery_failed"]) {
    assert.equal(evidence.runbook[needle], true, `runbook must mention ${needle}`);
  }
  assert.equal(
    validateObservabilityReadinessEvidence(evidence, { repoRoot: process.cwd() }).ok,
    true,
  );
});

test("readiness rejects missing, malformed or contradictory failures", () => {
  const { evidenceSha256: _checksum, ...core } = buildObservabilityReadinessEvidence({
    repoRoot: process.cwd(),
    env: alertEnv,
  });
  for (const verdict of [
    { passed: true },
    { passed: true, failures: null },
    { passed: true, failures: "" },
    { passed: true, failures: ["alert_not_configured"] },
  ]) {
    const result = validateObservabilityReadinessEvidence(
      withObservabilityChecksum({ ...core, verdict }),
      { repoRoot: process.cwd() },
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /explicit empty failures array/u);
  }
});

test("validateObservabilityReadinessEvidence fails checkout re-check when OPERATIONS lacks a needle", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-evidence-runbook-"));
  try {
    writeMinimalCheckout(dir);
    const evidence = buildObservabilityReadinessEvidence({ repoRoot: dir, env: alertEnv });
    assert.equal(evidence.verdict.passed, true);
    assert.equal(validateObservabilityReadinessEvidence(evidence, { repoRoot: dir }).ok, true);

    const operationsPath = join(dir, "docs/OPERATIONS.md");
    writeFileSync(
      operationsPath,
      operationsWithNeedles(
        OBSERVABILITY_RUNBOOK_MENTIONS.filter((n) => n !== "publication_delivery_failed"),
      ),
    );
    const result = validateObservabilityReadinessEvidence(evidence, { repoRoot: dir });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /publication_delivery_failed/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateObservabilityReadinessEvidence fails checkout re-check when a required script is removed", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-evidence-script-"));
  try {
    writeMinimalCheckout(dir);
    const evidence = buildObservabilityReadinessEvidence({ repoRoot: dir, env: alertEnv });
    assert.equal(evidence.verdict.passed, true);

    unlinkSync(join(dir, "scripts/check-web-push-worker-queue.mjs"));
    const result = validateObservabilityReadinessEvidence(evidence, { repoRoot: dir });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /check-web-push-worker-queue/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buildObservabilityReadinessEvidence fails when OPERATIONS omits a required needle", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-evidence-build-"));
  try {
    writeMinimalCheckout(dir, {
      operationsBody: operationsWithNeedles(
        OBSERVABILITY_RUNBOOK_MENTIONS.filter((n) => n !== "build_incident_delivery_failed"),
      ),
    });
    const evidence = buildObservabilityReadinessEvidence({ repoRoot: dir, env: alertEnv });
    assert.equal(evidence.verdict.passed, false);
    assert.ok(
      evidence.verdict.failures.some((f) => f === "runbook:build_incident_delivery_failed"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
