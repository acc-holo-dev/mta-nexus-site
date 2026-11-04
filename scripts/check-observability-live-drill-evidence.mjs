#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";
import {
  readObservabilityEvidenceFile,
  validateObservabilityLiveDrillEvidence,
} from "./observability-evidence-lib.mjs";

const path = resolve(
  process.cwd(),
  process.argv[2] || "artifacts/observability-live-drill-evidence.json",
);
const evidence = readObservabilityEvidenceFile(path);
const result = validateObservabilityLiveDrillEvidence(evidence);

if (!result.ok) {
  process.stderr.write(`observability-live-drill-evidence: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write("observability-live-drill-evidence: passed\n");
