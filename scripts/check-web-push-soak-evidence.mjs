#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const path = resolve(
  process.cwd(),
  process.argv[2] || "artifacts/web-push-soak-evidence.json",
);

function fail(message) {
  process.stderr.write(`web-push-soak-evidence: ${message}\n`);
  process.exitCode = 1;
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(path, "utf8"));
} catch {
  fail("missing or invalid evidence JSON");
  process.exit();
}

if (
  evidence?.schemaVersion !== 1 ||
  evidence?.kind !== "web_push_production_duration_soak"
) {
  fail("unexpected schema or evidence kind");
  process.exit();
}

const { evidenceSha256, ...core } = evidence;
const expected = createHash("sha256")
  .update(JSON.stringify(core))
  .digest("hex");
if (
  typeof evidenceSha256 !== "string" ||
  evidenceSha256 !== expected
) {
  fail("evidence checksum mismatch");
}

if (evidence?.verdict?.passed !== true) {
  fail(
    "soak verdict is not passed: " +
      JSON.stringify(evidence?.verdict?.failures ?? []),
  );
}

if (
  !Number.isSafeInteger(evidence?.fixture?.jobs) ||
  evidence.fixture.jobs < 1 ||
  evidence?.delivery?.acceptedUnique !== evidence.fixture.jobs ||
  evidence?.delivery?.duplicateAccepts !== 0 ||
  evidence?.queue?.finalFixturePending !== 0
) {
  fail("delivery/queue invariants are incomplete");
}

if (
  evidence?.cleanup?.attempted !== true ||
  evidence?.cleanup?.succeeded !== true
) {
  fail("fixture cleanup was not proven");
}

if (
  !Number.isSafeInteger(evidence?.timing?.durationActualMs) ||
  evidence.timing.durationActualMs <
    evidence?.timing?.durationTargetMs
) {
  fail("duration evidence is incomplete");
}

if (!process.exitCode) {
  process.stdout.write(
    `web-push-soak-evidence: passed jobs=${evidence.fixture.jobs} durationMs=${evidence.timing.durationActualMs}\n`,
  );
}
