#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";
import {
  readObservabilityEvidenceFile,
  validateObservabilityReadinessEvidence,
} from "./observability-evidence-lib.mjs";

const path = resolve(
  process.cwd(),
  process.argv[2] || "artifacts/observability-readiness-evidence.json",
);
const evidence = readObservabilityEvidenceFile(path);
const result = validateObservabilityReadinessEvidence(evidence);

if (!result.ok) {
  process.stderr.write(`observability-readiness-evidence: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write("observability-readiness-evidence: passed\n");
