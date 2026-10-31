import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_RESTORE_EVIDENCE_FLAGS } from "./backup-restore-contract.mjs";
import { requiredJobs } from "./ci-policy.mjs";
import { evaluateLegalSurfaces } from "./legal-surfaces-lib.mjs";
import { evaluateObservabilityEvidenceResidual } from "./observability-evidence-lib.mjs";
import { evaluateWebPushEvidenceResidual } from "./web-push-evidence-lib.mjs";

/** ROADMAP 20 automated evidence categories for a checkable free open-beta candidate. */
export const BETA_CANDIDATE_CATEGORIES = Object.freeze([
  Object.freeze({
    id: "exact_sha_ci",
    title: "Exact-SHA full CI acceptance",
    required: true,
    proof: "ci-evidence",
    description:
      "artifacts/ci-evidence.json reports full_acceptance PASS for the candidate commit SHA.",
  }),
  Object.freeze({
    id: "tls_and_runtime",
    title: "TLS / production runtime rehearse",
    required: true,
    proof: "ci-jobs",
    jobs: Object.freeze(["smoke", "production-compose"]),
    description: "Production smoke and production Compose startup succeeded on the candidate SHA.",
  }),
  Object.freeze({
    id: "mail",
    title: "Mail worker / SMTP acceptance",
    required: true,
    proof: "ci-jobs",
    jobs: Object.freeze(["mail-worker"]),
    description: "Isolated TLS SMTP and production mail-worker checks succeeded.",
  }),
  Object.freeze({
    id: "storage_and_scanner",
    title: "Storage and scanner contour",
    required: true,
    proof: "ci-jobs",
    jobs: Object.freeze(["local-compose", "production-compose", "smoke"]),
    description:
      "Local/production Compose and smoke cover private storage mounts and ClamAV fail-closed contour.",
  }),
  Object.freeze({
    id: "browsers",
    title: "Browser acceptance",
    required: true,
    proof: "ci-jobs",
    jobs: Object.freeze(["auth-browser", "directory-browser", "resource-browser"]),
    description: "Auth, directory, and resource Chromium acceptance jobs succeeded.",
  }),
  Object.freeze({
    id: "database_upgrade",
    title: "Forward-only database upgrade rehearsal",
    required: true,
    proof: "artifact",
    artifact: "artifacts/release-upgrade.json",
    description:
      "release-upgrade evidence reports PASS for the candidate SHA with verification flags true.",
  }),
  Object.freeze({
    id: "backup_restore",
    title: "Disposable-volume backup/restore rehearsal",
    required: true,
    proof: "artifact",
    artifact: "artifacts/backup-restore-evidence.json",
    description:
      "backup-restore evidence reports PASS for the candidate SHA (ROADMAP 19 CI disposable runner).",
  }),
  Object.freeze({
    id: "web_push",
    title: "Web Push provider/soak evidence",
    required: false,
    proof: "external",
    artifacts: Object.freeze([
      "artifacts/web-push-soak-evidence.json",
      "artifacts/web-push-provider-evidence.json",
    ]),
    description:
      "Optional retained soak/provider JSON must both validate via checkers; presence alone never clears the residual, and absence remains a named residual—not a free-beta marketplace claim.",
  }),
  Object.freeze({
    id: "observability",
    title: "Observability / operator readiness",
    required: false,
    proof: "external",
    artifacts: Object.freeze(["artifacts/observability-readiness-evidence.json"]),
    description:
      "Optional operator readiness JSON from `pnpm observability:ready` must validate (alert thresholds + in-repo probes/runbooks). Presence alone never clears; production vendor routing remains a human gate.",
  }),
  Object.freeze({
    id: "legal_surfaces",
    title: "Terms / Privacy / Community rules published",
    required: false,
    proof: "repo",
    description:
      "In-repo Terms/Privacy/Community rules pages exist, are linked, and carry RU/EN substance. Counsel review remains a separate human gate—not invented by this harness.",
  }),
  Object.freeze({
    id: "deployment_authorization",
    title: "Production deployment authorization",
    required: true,
    proof: "owner-never-auto",
    description:
      "Separate owner permission is required; this harness never authorizes production deploy.",
  }),
]);

export const BETA_CANDIDATE_OUT_OF_SCOPE = Object.freeze([
  "Real payment processing / paid marketplace activation",
  "DRM enforcement beyond current closed-beta runtime facts",
  "Invite-only staged creator launch (owner chose open free beta)",
  "Claiming open beta is live from a local or CI report alone",
]);

export const FULL_ACCEPTANCE_JOBS = Object.freeze(
  requiredJobs({ code: true, unitOnly: false, full: true }),
);

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function shaMatches(candidateSha, reportedSha) {
  return (
    typeof candidateSha === "string" &&
    typeof reportedSha === "string" &&
    candidateSha.length >= 40 &&
    reportedSha.startsWith(candidateSha.slice(0, 40))
  );
}

function jobSuccess(ciEvidence, jobName) {
  if (ciEvidence?.jobResults && typeof ciEvidence.jobResults === "object") {
    return ciEvidence.jobResults[jobName] === "success";
  }
  const needs = ciEvidence?.needs ?? ciEvidence?.jobs ?? null;
  if (!needs || typeof needs !== "object") return false;
  const entry = needs[jobName];
  if (!entry) return false;
  return entry.result === "success" || entry === "success";
}

function evaluateCiJobs(category, ciEvidence, candidateSha) {
  if (!ciEvidence) {
    return {
      status: "blocked",
      reason: "Missing artifacts/ci-evidence.json for the candidate SHA.",
    };
  }
  if (ciEvidence.scope !== "full_acceptance") {
    return {
      status: "blocked",
      reason: `CI evidence scope is ${ciEvidence.scope ?? "unknown"}, not full_acceptance.`,
    };
  }
  if (ciEvidence.status !== "PASS") {
    return {
      status: "blocked",
      reason: `CI evidence status is ${ciEvidence.status ?? "unknown"}, not PASS.`,
    };
  }
  if (!shaMatches(candidateSha, ciEvidence.sha)) {
    return {
      status: "blocked",
      reason: "CI evidence SHA does not match the candidate commit.",
    };
  }
  const missing = (category.jobs ?? []).filter((job) => !jobSuccess(ciEvidence, job));
  if (missing.length) {
    return {
      status: "blocked",
      reason: `Required CI jobs not successful: ${missing.join(", ")}.`,
    };
  }
  return { status: "passed", reason: null };
}

function evaluateUpgradeArtifact(path, candidateSha) {
  const body = readJsonIfPresent(path);
  if (!body) {
    return {
      status: "blocked",
      reason: `Missing ${path}; download release-upgrade-<sha> from full_acceptance CI.`,
    };
  }
  const sha = body.sha ?? body.repository?.sha ?? body.commit ?? null;
  if (candidateSha && sha && !shaMatches(candidateSha, sha)) {
    return {
      status: "blocked",
      reason: "release-upgrade evidence SHA does not match the candidate commit.",
    };
  }
  if (body.status !== "PASS") {
    return {
      status: "blocked",
      reason: `release-upgrade status is ${body.status ?? "unknown"}, not PASS.`,
    };
  }
  return { status: "passed", reason: null };
}

function evaluateBackupArtifact(path, candidateSha) {
  const body = readJsonIfPresent(path);
  if (!body) {
    return {
      status: "blocked",
      reason:
        "Missing artifacts/backup-restore-evidence.json (ROADMAP 19 CI disposable-volume residual).",
    };
  }
  const sha = body.sha ?? body.repository?.sha ?? body.commit ?? null;
  if (candidateSha && sha && !shaMatches(candidateSha, sha)) {
    return {
      status: "blocked",
      reason: "backup-restore evidence SHA does not match the candidate commit.",
    };
  }
  if (body.status !== "PASS") {
    return {
      status: "blocked",
      reason: `backup-restore status is ${body.status ?? "unknown"}, not PASS.`,
    };
  }
  if (!sha) {
    return {
      status: "blocked",
      reason: "backup-restore evidence is missing the candidate SHA.",
    };
  }
  const incompleteFlags = BACKUP_RESTORE_EVIDENCE_FLAGS.filter((flag) => body[flag] !== true);
  if (incompleteFlags.length) {
    return {
      status: "blocked",
      reason: `backup-restore evidence incomplete: ${incompleteFlags.join(", ")}.`,
      incompleteFlags,
    };
  }
  return {
    status: "passed",
    reason: null,
  };
}

function evaluateExternal(category, artifactRoot = process.cwd()) {
  if (category.id === "web_push") {
    return evaluateWebPushEvidenceResidual({
      artifactRoot,
      soakRelativePath: category.artifacts?.[0] ?? "artifacts/web-push-soak-evidence.json",
      providerRelativePath: category.artifacts?.[1] ?? "artifacts/web-push-provider-evidence.json",
    });
  }
  const present = (category.artifacts ?? []).filter((path) =>
    existsSync(resolveUnder(artifactRoot, path)),
  );
  if (!present.length) {
    return {
      status: "residual",
      reason: `Optional external evidence absent (${(category.artifacts ?? []).join(", ")}).`,
    };
  }
  return {
    status: "residual",
    reason: `Optional external evidence present but no validator is wired for ${category.id}.`,
    present,
  };
}

function resolveUnder(root, relativePath) {
  return `${root.replace(/\\/gu, "/").replace(/\/$/u, "")}/${relativePath.replace(/^\/+/u, "")}`;
}

/**
 * Local dated env backups must not block candidate evaluation.
 * Other untracked/modified paths still count as a dirty working tree.
 */
export function isDirtyWorkingTreeBeyondEnvBackups(porcelain) {
  if (typeof porcelain !== "string") return true;
  const lines = porcelain
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (!lines.length) return false;
  return lines.some((line) => {
    const path = line.replace(/^[ MADRCU?!]{1,2}\s+/u, "").replace(/^"(.*)"$/u, "$1");
    const file = path.includes(" -> ") ? path.slice(path.lastIndexOf(" -> ") + 4) : path;
    return (
      !/(?:^|\/)\.env\.backup-[^/]+$/u.test(file) && !/(?:^|\/)[^/]+\.env\.backup[^/]*$/u.test(file)
    );
  });
}

/**
 * Evaluate a free open-beta candidate package for one exact SHA.
 * Never authorizes production deployment or claims open beta is live.
 */
export function evaluateBetaCandidate({
  candidateSha,
  dirtyWorkingTree = true,
  ciEvidence = null,
  artifactRoot = process.cwd(),
} = {}) {
  const categories = BETA_CANDIDATE_CATEGORIES.map((category) => {
    let result;
    switch (category.proof) {
      case "ci-evidence": {
        if (!ciEvidence) {
          result = {
            status: "blocked",
            reason: "Missing artifacts/ci-evidence.json for the candidate SHA.",
          };
        } else if (!shaMatches(candidateSha, ciEvidence.sha)) {
          result = {
            status: "blocked",
            reason: "CI evidence SHA does not match the candidate commit.",
          };
        } else if (ciEvidence.scope !== "full_acceptance" || ciEvidence.status !== "PASS") {
          result = {
            status: "blocked",
            reason: `Need full_acceptance PASS; got scope=${ciEvidence.scope ?? "unknown"} status=${ciEvidence.status ?? "unknown"}.`,
          };
        } else {
          const missingJobs = FULL_ACCEPTANCE_JOBS.filter((job) => !jobSuccess(ciEvidence, job));
          result = missingJobs.length
            ? {
                status: "blocked",
                reason: `full_acceptance jobs missing or unsuccessful: ${missingJobs.join(", ")}.`,
              }
            : { status: "passed", reason: null };
        }
        break;
      }
      case "ci-jobs":
        result = evaluateCiJobs(category, ciEvidence, candidateSha);
        break;
      case "artifact": {
        const artifactPath = join(artifactRoot, category.artifact);
        result =
          category.id === "database_upgrade"
            ? evaluateUpgradeArtifact(artifactPath, candidateSha)
            : evaluateBackupArtifact(artifactPath, candidateSha);
        break;
      }
      case "external":
        result =
          category.id === "observability"
            ? evaluateObservabilityEvidenceResidual({
                artifactRoot,
                relativePath: category.artifacts?.[0] ?? "artifacts/observability-readiness-evidence.json",
              })
            : evaluateExternal(category, artifactRoot);
        break;
      case "repo":
        result =
          category.id === "legal_surfaces"
            ? evaluateLegalSurfaces(artifactRoot)
            : {
                status: "blocked",
                reason: `Unknown repo proof category: ${category.id}`,
              };
        break;
      case "owner":
        result = {
          status: "residual",
          reason: "Owner confirmation required; not auto-proven by this harness.",
        };
        break;
      case "owner-never-auto":
        result = {
          status: "blocked",
          reason: "Production deployment requires a separate explicit owner decision.",
        };
        break;
      default:
        result = { status: "blocked", reason: `Unknown proof kind: ${category.proof}` };
    }
    return Object.freeze({
      id: category.id,
      title: category.title,
      required: category.required,
      proof: category.proof,
      status: result.status,
      reason: result.reason,
      ...(result.incompleteFlags ? { incompleteFlags: result.incompleteFlags } : {}),
      ...(result.present ? { present: result.present } : {}),
      ...(result.note ? { note: result.note } : {}),
    });
  });

  const blockers = categories
    .filter((item) => item.required && item.status !== "passed")
    .map((item) => `${item.id}: ${item.reason ?? item.status}`);
  const residuals = categories
    .filter((item) => !item.required && item.status !== "passed")
    .map((item) => `${item.id}: ${item.reason ?? item.status}`);

  if (dirtyWorkingTree) {
    blockers.push("working_tree: candidate evaluation requires a clean checkout of the exact SHA.");
  }
  if (!candidateSha || !/^[a-f0-9]{40}([a-f0-9]{24})?$/iu.test(candidateSha)) {
    blockers.push("candidate_sha: exact Git SHA is required.");
  }

  // deployment_authorization is always blocked by design; checkableCandidate means
  // every required technical proof passed and only the owner deploy decision remains.
  const technicalBlockers = blockers.filter(
    (item) => !item.startsWith("deployment_authorization:"),
  );
  const checkableCandidate = technicalBlockers.length === 0;

  const status = checkableCandidate ? "awaiting_owner_deploy_decision" : "blocked";

  return Object.freeze({
    schemaVersion: 1,
    scope: "open_free_beta_candidate",
    candidateSha: candidateSha ?? null,
    dirtyWorkingTree: dirtyWorkingTree !== false,
    status,
    checkableCandidate,
    openBetaLive: false,
    productionAuthorized: false,
    outOfScope: BETA_CANDIDATE_OUT_OF_SCOPE,
    fullAcceptanceJobs: FULL_ACCEPTANCE_JOBS,
    categories,
    blockers,
    technicalBlockers,
    residuals,
    limitations: Object.freeze([
      "This report never claims open beta is live.",
      "This report never authorizes production deployment.",
      "Paid marketplace and DRM activation remain out of scope for free open beta.",
      "Backup/restore PASS requires disposable CI evidence for the exact SHA (ROADMAP 19).",
    ]),
  });
}

export function buildBetaCandidateChecksum(evidence) {
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}

export function readCiEvidence(path = "artifacts/ci-evidence.json") {
  return readJsonIfPresent(path);
}
