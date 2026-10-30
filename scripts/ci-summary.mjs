import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { requiredJobs, summarizeJobs } from "./ci-policy.mjs";

const policy = {
  code: process.env.CI_CODE === "true",
  unitOnly: process.env.CI_UNIT_ONLY === "true",
  full: process.env.CI_FULL === "true",
};
const needs = JSON.parse(process.env.CI_JOB_RESULTS);
const required = requiredJobs(policy);
const report = {
  sha: process.env.GITHUB_SHA,
  ...summarizeJobs(policy, needs),
  requiredJobs: required,
  jobResults: Object.fromEntries(required.map((name) => [name, needs[name]?.result ?? "missing"])),
};
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/ci-evidence.json", JSON.stringify(report, null, 2));
appendFileSync(
  process.env.GITHUB_STEP_SUMMARY,
  `### ${report.scope}: ${report.status}\nCommit: ${report.sha}\nRequired checks missing or unsuccessful: ${report.failedOrMissing.join(", ") || "none"}\n`,
);
if (report.status !== "PASS") process.exitCode = 1;
