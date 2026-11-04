#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";
import {
  readProductionRecoveryAcceptanceFile,
  validateProductionRecoveryAcceptanceEvidence,
} from "./production-recovery-acceptance-evidence.mjs";

const path = resolve(
  process.cwd(),
  process.argv[2] || "artifacts/production-recovery-acceptance-evidence.json",
);
const evidence = readProductionRecoveryAcceptanceFile(path);
const result = validateProductionRecoveryAcceptanceEvidence(evidence);

if (!result.ok) {
  process.stderr.write(`production-recovery-acceptance-evidence: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write("production-recovery-acceptance-evidence: passed\n");
