#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";
import {
  readWebPushEvidenceFile,
  validateWebPushProviderEvidence,
} from "./web-push-evidence-lib.mjs";

const path = resolve(process.cwd(), process.argv[2] || "artifacts/web-push-provider-evidence.json");
const evidence = readWebPushEvidenceFile(path);
const result = validateWebPushProviderEvidence(evidence);

if (!result.ok) {
  process.stderr.write(`web-push-provider-evidence: ${result.reason}\n`);
  process.exitCode = 1;
  process.exit();
}

process.stdout.write(
  `web-push-provider-evidence: passed provider=${evidence.target.origin} http=${evidence.response.statusCode}\n`,
);
