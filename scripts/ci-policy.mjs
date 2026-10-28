import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Changes to deployment, dependencies and trust boundaries require full acceptance.
const fullAcceptancePaths = [
  /^\.github\/workflows\//,
  /^Dockerfile$/,
  /^compose[^/]*\.ya?ml$/,
  /^deploy\//,
  /^packages\/db\/(?:migrations\/|scripts\/|src\/(?:[^/]+\/)*(?:[^/]*schema|migrate)\.ts$)/,
  /^scripts\//,
  /^vitest\.config\.ts$/,
  /^(?:[^/]+\/)*package\.json$/,
  /^pnpm-(?:lock|workspace)\.yaml$/,
  /^\.(?:nvmrc|node-version)$/,
  /^apps\/web\/next\.config\.(?:mjs|ts)$/,
  /^packages\/(?:config|security|storage)\//,
  /^packages\/db\/src\/repositories\/(?:initiating-session|commercial-plans|order-operations|subscriptions|entitlements|resource-cart)\.ts$/,
  /^apps\/web\/src\/app\/api\/auth\//,
  /^apps\/web\/src\/lib\/(?:browser-(?:request-policy|request-guard|route-adapter)|license-bearer-route-adapter)\.ts$/,
  /^tests\/(?:mainline-repository-policy|j4-production-upload-integration|browser-api-route-inventory)\.test\.ts$/,
];

export function classifyChanges(files, { explicitFull = false, release = false } = {}) {
  const code = files.some((file) => !/^(?:README\.md|docs\/(?:[^/\n]+\/)*[^/\n]+\.md)$/.test(file));
  const infrastructure = files.some((file) =>
    fullAcceptancePaths.some((pattern) => pattern.test(file)),
  );
  return { code: code || explicitFull || release, full: explicitFull || release || infrastructure };
}

export function requiredJobs({ code, full }) {
  // Full acceptance may not degrade into a documentation-only pass.
  if (!code && !full) return ["plan"];
  const jobs = ["plan", "unit", "verify", "image", "smoke"];
  if (full)
    jobs.push(
      "postgres-persistence",
      "local-compose",
      "backup-restore",
      "production-compose",
      "auth-browser",
      "directory-browser",
      "resource-browser",
      "mail-worker",
    );
  return jobs;
}

export function summarizeJobs(policy, needs) {
  const missing = requiredJobs(policy).filter((name) => needs[name]?.result !== "success");
  return {
    ...policy,
    status: missing.length ? "FAIL" : "PASS",
    failedOrMissing: missing,
    scope: policy.full ? "full_acceptance" : policy.code ? "fast_ci" : "documentation",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let base = event.pull_request?.base?.sha ?? event.before;
  if (!base || /^0+$/.test(base))
    base = execFileSync("git", ["hash-object", "-t", "tree", "/dev/null"], {
      encoding: "utf8",
    }).trim();
  const files =
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
      ? []
      : execFileSync("git", ["diff", "--name-only", "-z", base, head], { encoding: "utf8" })
          .split("\0")
          .filter(Boolean);
  const policy = classifyChanges(files, {
    explicitFull: event.inputs?.full === true || event.inputs?.full === "true",
    release: (process.env.GITHUB_REF ?? "").startsWith("refs/tags/v"),
  });
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") policy.code = true;
  appendFileSync(process.env.GITHUB_OUTPUT, `code=${policy.code}\nfull=${policy.full}\n`);
  console.log(JSON.stringify({ ...policy, changedFiles: files.length }));
}
