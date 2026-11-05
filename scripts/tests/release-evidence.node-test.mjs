import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildEvidenceChecksum,
  buildReleaseManifest,
  evaluateReleaseManifest,
  executeReleaseCommand,
  listMigrationEvidence,
  RELEASE_MANIFEST_SCHEMA_VERSION,
  RELEASE_RETENTION_CONTRACT,
  REQUIRED_RELEASE_GATES,
  repositoryStayedStable,
  summarizeExternalEvidence,
  summarizeReleaseEvidence,
  writeReleaseEvidence,
} from "../release-evidence-lib.mjs";

const sampleSha = "a".repeat(40);
const sampleLock = "b".repeat(64);

function sampleManifest(overrides = {}) {
  return buildReleaseManifest({
    appVersion: "1.2.0-beta.3",
    sha: sampleSha,
    lockfileSha256: sampleLock,
    toolchain: { actual: { node: "26.10.0", pnpm: "12.4.2" } },
    postgresMajor: 18,
    schema: { baseline: "0024_product_type_invariant", target: "0089_resource_qa" },
    migrations: [{ name: "0001.sql", sha256: "c".repeat(64) }],
    ...overrides,
  });
}

test("release summary passes only a clean tree with all gates passed", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
  });

  assert.equal(summary.status, "passed");
  assert.equal(summary.releaseCandidate, true);
  assert.deepEqual(summary.failedGates, []);
  assert.deepEqual(summary.blockedGates, []);
});

test("dirty trees remain blocked even when commands pass", () => {
  const summary = summarizeReleaseEvidence({
    dirty: true,
    gates: [{ name: "tests", status: "passed" }],
  });

  assert.equal(summary.status, "blocked");
  assert.equal(summary.releaseCandidate, false);
  assert.equal(summary.dirtyWorkingTree, true);
});

test("failed gates outrank blocked gates", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: [
      { name: "migrations", status: "blocked" },
      { name: "tests", status: "failed" },
    ],
  });

  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.failedGates, ["tests"]);
  assert.deepEqual(summary.blockedGates, ["migrations"]);
});

test("empty or unknown gate states remain blocked", () => {
  const empty = summarizeReleaseEvidence({
    dirty: false,
    gates: [],
  });
  assert.equal(empty.status, "blocked");
  assert.equal(empty.noGatesRecorded, true);

  const unknown = summarizeReleaseEvidence({
    dirty: false,
    gates: [{ name: "future_gate", status: "skipped" }],
  });
  assert.equal(unknown.status, "blocked");
  assert.deepEqual(unknown.incompleteGates, ["future_gate"]);
});

test("migration evidence is sorted and hashed without file contents", () => {
  const dir = mkdtempSync(join(tmpdir(), "nexus-release-evidence-"));
  writeFileSync(join(dir, "0002_b.sql"), "select 2;\n");
  writeFileSync(join(dir, "0001_a.sql"), "select 1;\n");
  writeFileSync(join(dir, "README.md"), "ignore");

  const migrations = listMigrationEvidence(dir);

  assert.deepEqual(
    migrations.map((item) => item.name),
    ["0001_a.sql", "0002_b.sql"],
  );
  assert.match(migrations[0].sha256, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(migrations).includes("select 1"), false);
});

test("evidence checksum changes with evidence content", () => {
  assert.notEqual(
    buildEvidenceChecksum({ status: "passed" }),
    buildEvidenceChecksum({ status: "failed" }),
  );
});

for (const missing of REQUIRED_RELEASE_GATES) {
  test(`release summary blocks missing required gate: ${missing}`, () => {
    const summary = summarizeReleaseEvidence({
      dirty: false,
      gates: REQUIRED_RELEASE_GATES.filter((name) => name !== missing).map((name) => ({
        name,
        status: "passed",
      })),
    });
    assert.equal(summary.releaseCandidate, false);
    assert.equal(summary.status, "blocked");
    assert.deepEqual(summary.missingGates, [missing]);
  });
}
test("duplicate successes cannot replace required evidence", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: [
      ...REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
      { name: "tests", status: "passed" },
    ],
  });
  assert.equal(summary.status, "blocked");
  assert.deepEqual(summary.duplicateGates, ["tests"]);
});
test("repository cleanliness must be explicitly confirmed", () => {
  const summary = summarizeReleaseEvidence({
    gates: REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
  });
  assert.equal(summary.releaseCandidate, false);
});
test("additional successful gates do not invalidate complete evidence", () => {
  const summary = summarizeReleaseEvidence({
    dirty: false,
    gates: [
      ...REQUIRED_RELEASE_GATES.map((name) => ({ name, status: "passed" })),
      { name: "extra_check", status: "passed" },
    ],
  });
  assert.equal(summary.releaseCandidate, true);
});

test("repository stability requires the same readable clean checkout", () => {
  const initialSha = "a".repeat(40);
  const baseline = { initialSha, finalSha: initialSha, statusAvailable: true, dirty: false };
  assert.equal(repositoryStayedStable(baseline), true);
  for (const change of [
    { finalSha: "b".repeat(40) },
    { finalSha: null },
    { initialSha: null },
    { initialSha: "", finalSha: "" },
    { statusAvailable: false },
    { dirty: true },
    { dirty: undefined },
  ]) {
    assert.equal(repositoryStayedStable({ ...baseline, ...change }), false);
  }
});

test("release commands record success and nonzero exit without command output", () => {
  const success = executeReleaseCommand(process.execPath, ["-e", "console.log('private output')"], {
    stdio: "pipe",
    timeoutMs: 5000,
  });
  assert.equal(success.status, "passed");
  assert.equal(success.timedOut, false);
  assert.equal(JSON.stringify(success).includes("private output"), false);
  const failure = executeReleaseCommand(process.execPath, ["-e", "process.exit(7)"], {
    stdio: "pipe",
    timeoutMs: 5000,
  });
  assert.equal(failure.status, "failed");
  assert.equal(failure.exitCode, 7);
});
test("a stuck release command times out and cannot pass", () => {
  const result = executeReleaseCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "pipe",
    timeoutMs: 200,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.timedOut, true);
  assert.equal(result.errorCode, "ETIMEDOUT");
  assert.equal(result.timeoutMs, 200);
});
test("spawn errors and invalid timeout values cannot pass", () => {
  const result = executeReleaseCommand("nexus-missing-executable-for-test", [], { stdio: "pipe" });
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "ENOENT");
  assert.throws(() => executeReleaseCommand(process.execPath, [], { timeoutMs: 0 }), RangeError);
});

test("evidence publication replaces a complete file and cleans staging", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-evidence-write-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "release-evidence.json");
  writeFileSync(path, '{"old":true}');
  writeReleaseEvidence(path, { status: "blocked", sha: "example" });
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { status: "blocked", sha: "example" });
  assert.deepEqual(readdirSync(directory), ["release-evidence.json"]);
});
test("serialization failure preserves the previous evidence", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-evidence-invalid-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "release-evidence.json");
  writeFileSync(path, '{"old":true}');
  const circular = {};
  circular.self = circular;
  assert.throws(() => writeReleaseEvidence(path, circular), TypeError);
  assert.equal(readFileSync(path, "utf8"), '{"old":true}');
  assert.deepEqual(readdirSync(directory), ["release-evidence.json"]);
});
test("failed publication cleans only its own temporary directory", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-evidence-failure-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const destination = join(directory, "release-evidence.json");
  mkdirSync(destination);
  writeFileSync(join(destination, "existing"), "keep");
  assert.throws(() => writeReleaseEvidence(destination, { status: "failed" }));
  assert.equal(readFileSync(join(destination, "existing"), "utf8"), "keep");
  assert.deepEqual(readdirSync(directory), ["release-evidence.json"]);
});

test("external evidence summary requires every declared artifact to be present valid and hashed", () => {
  const valid = {
    present: true,
    valid: true,
    sha256: "a".repeat(64),
  };
  assert.deepEqual(
    summarizeExternalEvidence({
      provider: valid,
      soak: { ...valid, sha256: "b".repeat(64) },
    }),
    {
      complete: true,
      missingOrInvalid: [],
    },
  );

  assert.deepEqual(
    summarizeExternalEvidence({
      provider: valid,
      soak: {
        present: false,
        valid: false,
        sha256: null,
      },
    }),
    {
      complete: false,
      missingOrInvalid: ["soak"],
    },
  );
});

test("external evidence summary does not treat an empty declaration as complete", () => {
  assert.deepEqual(summarizeExternalEvidence({}), {
    complete: false,
    missingOrInvalid: [],
  });
});

test("OPS-08 release manifest accepts unresolved image digests without authorizing production", () => {
  const manifest = sampleManifest();
  assert.equal(manifest.schemaVersion, RELEASE_MANIFEST_SCHEMA_VERSION);
  assert.equal(manifest.productionAuthorized, false);
  assert.equal(manifest.retention.ciArtifactDays, RELEASE_RETENTION_CONTRACT.ciArtifactDays);
  assert.equal(manifest.retention.releaseBundle.status, "owner_decision_required");
  const ok = evaluateReleaseManifest(manifest, {
    expectedSha: sampleSha,
    expectedSchema: {
      baseline: "0024_product_type_invariant",
      target: "0089_resource_qa",
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.productionAuthorized, false);
});

test("release manifest requires valid unique migration names and SHA-256 hashes", () => {
  const valid = { name: "0001_example.sql", sha256: "c".repeat(64) };
  for (const migrations of [
    [{}],
    [null],
    ["0001.sql"],
    [{ ...valid, name: "../0001_example.sql" }],
    [{ ...valid, name: "nested\\0001_example.sql" }],
    [{ ...valid, name: "0001_example.txt" }],
    [{ ...valid, sha256: "not-a-hash" }],
    [{ ...valid, sha256: "C".repeat(64) }],
    [valid, { ...valid }],
  ]) {
    const result = evaluateReleaseManifest(sampleManifest({ migrations }));
    assert.equal(result.ok, false);
    assert.equal(result.releaseCandidateTechnical, undefined);
    assert.match(result.reason, /migration names and SHA-256/u);
  }
  assert.equal(evaluateReleaseManifest(sampleManifest({ migrations: [valid] })).ok, true);
  const actualMigrations = listMigrationEvidence(join(process.cwd(), "packages/db/migrations"));
  assert.equal(evaluateReleaseManifest(sampleManifest({ migrations: actualMigrations })).ok, true);
});

test("OPS-08 release manifest blocks missing or mismatched digest SHA schema and unknown versions", () => {
  assert.match(evaluateReleaseManifest(sampleManifest({ sha: "deadbeef" })).reason, /SHA/u);
  assert.match(
    evaluateReleaseManifest(sampleManifest(), { expectedSha: "f".repeat(40) }).reason,
    /SHA mismatch/u,
  );
  assert.match(
    evaluateReleaseManifest({
      ...sampleManifest(),
      schemaVersion: 99,
    }).reason,
    /schemaVersion/u,
  );
  assert.match(
    evaluateReleaseManifest(sampleManifest({ schema: { baseline: null, target: "x" } })).reason,
    /baseline\/target/u,
  );
  assert.match(
    evaluateReleaseManifest(sampleManifest(), {
      expectedSchema: { baseline: "0024_product_type_invariant", target: "other" },
    }).reason,
    /target mismatch/u,
  );
  assert.match(
    evaluateReleaseManifest(
      sampleManifest({
        image: { digest: null, platform: null, sourceSha: sampleSha, status: "unresolved" },
      }),
      { requireImageDigest: true },
    ).reason,
    /image digest/u,
  );
  assert.match(
    evaluateReleaseManifest(
      sampleManifest({
        image: {
          digest: `sha256:${"1".repeat(64)}`,
          platform: "linux/amd64",
          sourceSha: "e".repeat(40),
          status: "resolved",
        },
      }),
    ).reason,
    /sourceSha/u,
  );
  assert.match(
    evaluateReleaseManifest({
      ...sampleManifest(),
      productionAuthorized: true,
    }).reason,
    /productionAuthorized/u,
  );
  assert.equal(
    evaluateReleaseManifest(
      sampleManifest({
        image: {
          digest: `sha256:${"1".repeat(64)}`,
          platform: "linux/amd64",
          sourceSha: sampleSha,
          status: "resolved",
        },
      }),
      { requireImageDigest: true },
    ).ok,
    true,
  );
});

test("strict app image validation requires a resolved digest for the exact SHA and platform", () => {
  const good = {
    digest: `sha256:${"1".repeat(64)}`,
    platform: "linux/amd64",
    sourceSha: sampleSha,
    status: "resolved",
  };
  const check = (image) =>
    evaluateReleaseManifest({ ...sampleManifest(), image }, { requireImageDigest: true });
  assert.equal(check(good).ok, true);
  for (const bad of [
    { ...good, digest: null },
    { ...good, digest: "sha256:bad" },
    { ...good, platform: null },
    { ...good, platform: "/" },
    { ...good, platform: "linux/arm/v7/extra" },
    { ...good, sourceSha: null },
    { ...good, sourceSha: "" },
    { ...good, sourceSha: "f".repeat(40) },
    { ...good, status: null },
    { ...good, status: "unresolved" },
    { digest: good.digest, platform: good.platform },
  ]) {
    assert.equal(check(bad).ok, false, JSON.stringify(bad));
  }
  // The existing non-strict technical check still permits an unresolved image.
  assert.equal(evaluateReleaseManifest(sampleManifest()).ok, true);
});

test("strict infra validation requires the complete resolved pin inventory", () => {
  const pins = JSON.parse(readFileSync("deploy/infra-image-pins.json", "utf8"));
  const good = pins.images;
  const check = (infraImages) =>
    evaluateReleaseManifest(sampleManifest({ infraImages }), { requireResolvedInfra: true });
  assert.equal(check(good).ok, true);
  for (const bad of [
    null,
    [],
    [good[0]],
    [...good, good[0]],
    [{ role: "invented", digest: `sha256:${"1".repeat(64)}` }],
    good.map((item, index) => (index === 0 ? { ...item, role: "invented" } : item)),
    good.map((item, index) => (index === 0 ? { ...item, ref: "node:latest" } : item)),
    good.map((item, index) => (index === 0 ? { ...item, digest: null } : item)),
    good.map((item, index) => (index === 0 ? { ...item, status: "unresolved" } : item)),
    good.map((item, index) => (index === 0 ? { ...item, platform: "linux/arm/v7/extra" } : item)),
    ...["ref", "digest", "status", "platform"].map((field) =>
      good.map((item, index) => {
        if (index !== 0) return item;
        const entry = { ...item };
        delete entry[field];
        return entry;
      }),
    ),
  ]) {
    assert.equal(check(bad).ok, false, JSON.stringify(bad));
  }
  assert.equal(evaluateReleaseManifest(sampleManifest()).ok, true);
});
