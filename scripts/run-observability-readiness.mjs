#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import {
  OBSERVABILITY_ALERT_ENV_KEYS,
  buildObservabilityReadinessEvidence,
} from "./observability-evidence-lib.mjs";

if (process.env.NEXUS_OBSERVABILITY_READY_ACK !== "YES") {
  throw new Error("Refusing observability readiness write without NEXUS_OBSERVABILITY_READY_ACK=YES");
}

/** Load missing keys from local `.env` without overriding the process environment. */
function envWithOptionalDotenv(baseEnv) {
  const merged = { ...baseEnv };
  const missing = OBSERVABILITY_ALERT_ENV_KEYS.some((key) => !merged[key]?.trim());
  if (!missing) return merged;
  const dotenvPath = resolve(process.cwd(), ".env");
  if (!existsSync(dotenvPath)) return merged;
  for (const line of readFileSync(dotenvPath, "utf8").split(/\r?\n/u)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    if (!OBSERVABILITY_ALERT_ENV_KEYS.includes(key)) continue;
    if (merged[key]?.trim()) continue;
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }
  return merged;
}

const evidencePath = resolve(
  process.cwd(),
  process.env.NEXUS_OBSERVABILITY_EVIDENCE_PATH?.trim() ||
    "artifacts/observability-readiness-evidence.json",
);

const evidence = buildObservabilityReadinessEvidence({
  repoRoot: process.cwd(),
  env: envWithOptionalDotenv(process.env),
});

await mkdir(dirname(evidencePath), { recursive: true });
const temporary = `${evidencePath}.tmp-${process.pid}`;
try {
  await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, evidencePath);
} finally {
  await rm(temporary, { force: true }).catch(() => undefined);
}

process.stdout.write(
  `observability-readiness: ${evidence.verdict.passed ? "passed" : "failed"} path=${evidencePath}\n`,
);
if (!evidence.verdict.passed) {
  process.stderr.write(`${JSON.stringify(evidence.verdict.failures)}\n`);
  process.exitCode = 1;
}
