#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";
import { readWebPushEvidenceFile, validateWebPushSoakEvidence } from "./web-push-evidence-lib.mjs";

const path = resolve(process.cwd(), process.argv[2] || "artifacts/web-push-soak-evidence.json");
const evidence = readWebPushEvidenceFile(path);
const result = validateWebPushSoakEvidence(evidence);

if (!result.ok) {
  process.stderr.write(`web-push-soak-evidence: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write(
  `web-push-soak-evidence: passed jobs=${evidence.fixture.jobs} durationMs=${evidence.timing.durationActualMs}\n`,
);
