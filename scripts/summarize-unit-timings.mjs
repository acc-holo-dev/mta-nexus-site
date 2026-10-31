#!/usr/bin/env node
/**
 * Summarize Vitest JSON reporter output from `pnpm test:unit`
 * (artifacts/unit-tests.json). Read-only; does not change test policy.
 *
 * Usage:
 *   node scripts/summarize-unit-timings.mjs [path/to/unit-tests.json] [--top=20]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const topArg = args.find((arg) => arg.startsWith("--top="));
const top = topArg ? Number(topArg.slice("--top=".length)) : 20;
const reportPath = resolve(
  args.find((arg) => !arg.startsWith("--")) ?? "artifacts/unit-tests.json",
);

if (!Number.isInteger(top) || top < 1 || top > 500) {
  console.error("--top must be an integer from 1 to 500");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Unable to read Vitest JSON report at ${reportPath}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const files = [];
for (const suite of report.testResults ?? []) {
  const durationMs = Number(suite.endTime) - Number(suite.startTime);
  if (!Number.isFinite(durationMs) || durationMs < 0) continue;
  files.push({
    file: String(suite.name ?? "").replaceAll("\\", "/"),
    durationMs,
    status: suite.status ?? "unknown",
    assertionCount: Array.isArray(suite.assertionResults) ? suite.assertionResults.length : 0,
  });
}

files.sort((left, right) => right.durationMs - left.durationMs);

const totalMs = files.reduce((sum, file) => sum + file.durationMs, 0);
const latestEnd = Math.max(
  0,
  ...((report.testResults ?? []).map((suite) => Number(suite.endTime)).filter(Number.isFinite)),
);
const startTime = Number(report.startTime);
const wallMs =
  Number.isFinite(Number(report.endTime)) && Number.isFinite(startTime)
    ? Number(report.endTime) - startTime
    : Number.isFinite(startTime) && latestEnd > startTime
      ? latestEnd - startTime
      : null;
const slowShare = files.slice(0, top).reduce((sum, file) => sum + file.durationMs, 0);

console.log(`Report: ${reportPath}`);
console.log(`Files: ${files.length}`);
console.log(
  wallMs === null
    ? `Sum of per-file durations: ${(totalMs / 1000).toFixed(1)}s`
    : `Sum of per-file durations: ${(totalMs / 1000).toFixed(1)}s (parallel wall ≈ ${(wallMs / 1000).toFixed(1)}s)`,
);
console.log(`Top ${top} share of summed file time: ${((100 * slowShare) / Math.max(totalMs, 1)).toFixed(1)}%`);
console.log("");
console.log("| # | s | assertions | file |");
console.log("| - | - | ---------- | ---- |");
for (const [index, file] of files.slice(0, top).entries()) {
  const relative = file.file.includes("/mta-nexus-site/")
    ? file.file.split("/mta-nexus-site/").at(-1)
    : file.file.replace(/^.*?mta-nexus-site\//u, "");
  console.log(
    `| ${index + 1} | ${(file.durationMs / 1000).toFixed(2)} | ${file.assertionCount} | ${relative || file.file} |`,
  );
}
