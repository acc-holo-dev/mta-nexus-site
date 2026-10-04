import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { summarizeJobs } from "./ci-policy.mjs";
const report = { sha: process.env.GITHUB_SHA, ...summarizeJobs({
  code: process.env.CI_CODE === "true", full: process.env.CI_FULL === "true",
}, JSON.parse(process.env.CI_JOB_RESULTS)) };
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/ci-evidence.json", JSON.stringify(report, null, 2));
appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${report.scope}: ${report.status}\nCommit: ${report.sha}\nRequired checks missing or unsuccessful: ${report.failedOrMissing.join(", ") || "none"}\n`);
if (report.status !== "PASS") process.exitCode = 1;
