import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const documentationPath = /^(?:README\.md|docs\/(?:[^/\n]+\/)*[^/\n]+\.md)$/;

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
  /^packages\/db\/src\/repositories\/(?:initiating-session|commercial-plans|order-operations|subscriptions|entitlements|resource-cart|community-reports|notifications|discussion-management|organization-governance|license-controls)\.ts$/,
  /^packages\/db\/src\/repositories\/(?:library-collections|library-collection-(?:command|internals)|library-membership-batches|library-selection-batches)\.ts$/,
  /^packages\/db\/src\/repositories\/(?:resource-library-selections|resource-release-watches|resource-release-watch-batches|collection-release-watches)\.ts$/,
  /^packages\/db\/src\/repositories\/(?:web-push-(?:admission-recovery|outbox|worker)|report-notification-delivery|verification-notification-delivery|discussion-notification-delivery|publication-notification-delivery|user-follow-notice|resource-release-worker|support-requester-notice|verification|discussion-moderation-notice|publication-notice|organization-access-notice|license-maintenance|content-reaction-notice|builds)\.ts$/,
  /^packages\/db\/src\/repositories\/(?:support|support-notification-delivery)\.ts$/,
  /^apps\/web\/src\/app\/api\/auth\//,
  /^apps\/web\/src\/lib\/(?:browser-(?:request-policy|request-guard|route-adapter)|license-bearer-route-adapter)\.ts$/,
  /^tests\/(?:mainline-repository-policy|j4-production-upload-integration|browser-api-route-inventory)\.test\.ts$/,
];

// Narrow unit profile: only shared UI and web components (and their colocated tests).
// Anything else — including unknown paths — stays on fast_ci or full_acceptance.
const unitOnlyPaths = [
  /^packages\/ui\//,
  /^apps\/web\/src\/components\//,
  /^apps\/web\/src\/components\/.+\.(?:test|spec)\.[cm]?[jt]sx?$/,
];

function isDocumentation(file) {
  return documentationPath.test(file);
}

function isUnitOnlyPath(file) {
  return unitOnlyPaths.some((pattern) => pattern.test(file));
}

export function classifyChanges(files, { explicitFull = false, release = false } = {}) {
  const code = files.some((file) => !isDocumentation(file));
  const infrastructure = files.some((file) =>
    fullAcceptancePaths.some((pattern) => pattern.test(file)),
  );
  const full = explicitFull || release || infrastructure;
  const codeFiles = files.filter((file) => !isDocumentation(file));
  // Empty or unknown-heavy sets must not claim unit_only; default wider, never narrower.
  const unitOnly = !full && codeFiles.length > 0 && codeFiles.every((file) => isUnitOnlyPath(file));
  return {
    code: code || explicitFull || release || unitOnly,
    unitOnly,
    full,
  };
}

export function requiredJobs({ code, unitOnly, full }) {
  // Full acceptance may not degrade into a documentation-only or unit-only pass.
  if (!code && !full) return ["plan"];
  if (full) {
    return [
      "plan",
      "unit",
      "verify",
      "image",
      "smoke",
      "postgres-persistence",
      "local-compose",
      "backup-restore",
      "production-compose",
      "auth-browser",
      "directory-browser",
      "resource-browser",
      "mail-worker",
    ];
  }
  if (unitOnly) return ["plan", "unit"];
  return ["plan", "unit", "verify", "image", "smoke"];
}

export function summarizeJobs(policy, needs) {
  const missing = requiredJobs(policy).filter((name) => needs[name]?.result !== "success");
  return {
    ...policy,
    status: missing.length ? "FAIL" : "PASS",
    failedOrMissing: missing,
    scope: policy.full
      ? "full_acceptance"
      : policy.unitOnly
        ? "unit_ci"
        : policy.code
          ? "fast_ci"
          : "documentation",
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
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    // Manual runs default to fast_ci unless full acceptance is requested.
    policy.code = true;
    policy.unitOnly = false;
  }
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `code=${policy.code}\nunit_only=${policy.unitOnly}\nfull=${policy.full}\n`,
  );
  console.log(JSON.stringify({ ...policy, changedFiles: files.length }));
}
