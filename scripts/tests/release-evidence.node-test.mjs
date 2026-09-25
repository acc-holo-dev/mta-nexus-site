import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const evidenceEnvNames = [
  "NEXUS_EVIDENCE_VERIFY",
  "NEXUS_EVIDENCE_ACCOUNT_BROWSER",
  "NEXUS_EVIDENCE_DIRECTORY_BROWSER",
  "NEXUS_EVIDENCE_POSTGRES_PERSISTENCE",
  "NEXUS_EVIDENCE_LOCAL_DOCKER",
  "NEXUS_EVIDENCE_PRODUCTION_DOCKER",
  "NEXUS_EVIDENCE_COMMIT",
  "NEXUS_EVIDENCE_REF",
  "NEXUS_EVIDENCE_PRODUCTION_IMAGE_DIGEST",
  "NEXUS_EVIDENCE_OUTPUT_DIR",
];

function cleanEnvironment() {
  const env = { ...process.env };
  for (const name of evidenceEnvNames) delete env[name];
  return env;
}

test("release evidence stays descriptive even when every recorded gate passes", async () => {
  const output = await mkdtemp(join(tmpdir(), "nexus-release-evidence-"));

  try {
    const stdout = execFileSync(
      process.execPath,
      ["scripts/write-release-evidence.mjs"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...cleanEnvironment(),
          NEXUS_EVIDENCE_OUTPUT_DIR: output,
          NEXUS_EVIDENCE_COMMIT: "0123456789abcdef",
          NEXUS_EVIDENCE_REF: "test-ref",
          NEXUS_EVIDENCE_VERIFY: "success",
          NEXUS_EVIDENCE_ACCOUNT_BROWSER: "success",
          NEXUS_EVIDENCE_DIRECTORY_BROWSER: "success",
          NEXUS_EVIDENCE_POSTGRES_PERSISTENCE: "success",
          NEXUS_EVIDENCE_LOCAL_DOCKER: "success",
          NEXUS_EVIDENCE_PRODUCTION_DOCKER: "success",
          NEXUS_EVIDENCE_PRODUCTION_IMAGE_DIGEST: "sha256:test",
        },
      },
    );

    const commandResult = JSON.parse(stdout);
    const evidence = JSON.parse(
      await readFile(join(output, "release-evidence.json"), "utf8"),
    );
    const markdown = await readFile(
      join(output, "release-evidence.md"),
      "utf8",
    );

    assert.equal(commandResult.status, "ok");
    assert.equal(evidence.schemaVersion, 1);
    assert.equal(evidence.source.commit, "0123456789abcdef");
    assert.equal(evidence.summary.allRequiredGatesRecorded, true);
    assert.equal(evidence.summary.allRequiredGatesPassed, true);
    assert.equal(evidence.releaseDecision, "not-recorded");
    assert.equal(evidence.artifacts.productionImageDigest, "sha256:test");
    assert.match(evidence.repository.lockfileSha256, /^[a-f0-9]{64}$/u);
    assert(evidence.repository.migrations.count > 0);
    assert.match(markdown, /Release decision: \*\*not recorded\*\*/u);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("unrecorded gates keep the evidence incomplete", async () => {
  const output = await mkdtemp(join(tmpdir(), "nexus-release-evidence-"));

  try {
    execFileSync(process.execPath, ["scripts/write-release-evidence.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...cleanEnvironment(),
        NEXUS_EVIDENCE_OUTPUT_DIR: output,
        NEXUS_EVIDENCE_COMMIT: "fedcba9876543210",
        NEXUS_EVIDENCE_REF: "partial-test",
        NEXUS_EVIDENCE_VERIFY: "success",
      },
    });

    const evidence = JSON.parse(
      await readFile(join(output, "release-evidence.json"), "utf8"),
    );

    assert.equal(evidence.summary.allRequiredGatesRecorded, false);
    assert.equal(evidence.summary.allRequiredGatesPassed, false);
    assert.equal(evidence.gates.verify, "success");
    assert.equal(evidence.gates.accountBrowser, "not-recorded");
    assert.equal(evidence.releaseDecision, "not-recorded");
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
