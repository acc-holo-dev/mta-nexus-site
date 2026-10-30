import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const BETA_CANDIDATE_ARTIFACT_TARGETS = Object.freeze([
  Object.freeze({
    id: "ci_evidence",
    localPath: "artifacts/ci-evidence.json",
    namePrefix: "ci-evidence-",
    requireAttemptSuffix: false,
  }),
  Object.freeze({
    id: "release_upgrade",
    localPath: "artifacts/release-upgrade.json",
    namePrefix: "release-upgrade-",
    requireAttemptSuffix: true,
  }),
  Object.freeze({
    id: "backup_restore",
    localPath: "artifacts/backup-restore-evidence.json",
    namePrefix: "backup-restore-",
    requireAttemptSuffix: true,
  }),
]);

export function normalizeCandidateSha(value) {
  if (typeof value !== "string") return null;
  const sha = value.trim().toLowerCase();
  return /^[a-f0-9]{7,64}$/u.test(sha) ? sha : null;
}

export function pickArtifactName(names, { namePrefix, sha, requireAttemptSuffix }) {
  const matches = names
    .filter((name) => typeof name === "string")
    .filter((name) => name.startsWith(namePrefix))
    .filter((name) => name.slice(namePrefix.length).startsWith(sha))
    .map((name) => {
      const rest = name.slice(namePrefix.length + sha.length);
      if (!requireAttemptSuffix) {
        return rest === "" ? { name, attempt: 0 } : null;
      }
      const match = /^-(\d+)$/u.exec(rest);
      return match ? { name, attempt: Number(match[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.attempt - a.attempt);
  return matches[0]?.name ?? null;
}

export function findJsonPayload(directory) {
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) return path;
    }
  }
  return null;
}

export function createGhRunner(execGh = defaultExecGh) {
  return {
    listRuns(sha) {
      const result = execGh([
        "run",
        "list",
        "--workflow",
        "ci.yml",
        "--commit",
        sha,
        "--json",
        "databaseId,conclusion,status,headSha,displayTitle,url,createdAt",
        "--limit",
        "20",
      ]);
      if (!result.ok) {
        throw new Error(`gh run list failed: ${result.stderr || result.stdout || "unknown error"}`);
      }
      return JSON.parse(result.stdout || "[]");
    },
    listArtifacts(runId) {
      const result = execGh([
        "api",
        `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`,
        "--paginate",
        "--jq",
        ".artifacts[] | {name, expired, size_in_bytes}",
      ]);
      if (!result.ok) {
        throw new Error(
          `gh api artifacts failed for run ${runId}: ${result.stderr || result.stdout || "unknown"}`,
        );
      }
      const lines = (result.stdout || "")
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.map((line) => JSON.parse(line));
    },
    downloadArtifact(runId, name, directory) {
      const result = execGh(["run", "download", String(runId), "-n", name, "-D", directory]);
      if (!result.ok) {
        throw new Error(
          `gh run download failed for ${name}: ${result.stderr || result.stdout || "unknown"}`,
        );
      }
    },
  };
}

function defaultExecGh(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    shell: false,
    timeout: 120_000,
  });
  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
  };
}

export function selectSuccessfulRun(runs, sha) {
  const normalized = sha.toLowerCase();
  const candidates = (runs ?? [])
    .filter((run) => typeof run?.headSha === "string")
    .filter((run) => run.headSha.toLowerCase().startsWith(normalized))
    .filter((run) => run.conclusion === "success" && run.status === "completed")
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return candidates[0] ?? null;
}

/**
 * Download retained CI evidence for an exact SHA into local artifact paths.
 * Never invents PASS JSON; fails when required artifacts are missing/expired.
 */
export function fetchBetaCandidateEvidence({
  sha,
  root = process.cwd(),
  gh = createGhRunner(),
  targets = BETA_CANDIDATE_ARTIFACT_TARGETS,
} = {}) {
  const candidateSha = normalizeCandidateSha(sha);
  if (!candidateSha) {
    throw new Error("Exact candidate SHA is required (7–64 hex).");
  }

  const runs = gh.listRuns(candidateSha);
  const run = selectSuccessfulRun(runs, candidateSha);
  if (!run) {
    throw new Error(
      `No successful ci.yml run found for commit ${candidateSha}. Wait for full_acceptance before fetching ROADMAP 19 evidence.`,
    );
  }

  const artifacts = gh.listArtifacts(run.databaseId);
  const liveNames = artifacts.filter((item) => item.expired !== true).map((item) => item.name);
  const resolved = targets.map((target) => {
    const name = pickArtifactName(liveNames, {
      namePrefix: target.namePrefix,
      sha: run.headSha.toLowerCase(),
      requireAttemptSuffix: target.requireAttemptSuffix,
    });
    return { ...target, artifactName: name };
  });

  const missing = resolved.filter((item) => !item.artifactName).map((item) => item.id);
  if (missing.length) {
    throw new Error(
      `Required CI artifacts missing or expired for ${run.headSha} (run ${run.databaseId}): ${missing.join(", ")}. Retention is 14 days; re-run full_acceptance if needed.`,
    );
  }

  const installed = [];
  for (const item of resolved) {
    const temp = mkdtempSync(join(tmpdir(), `nexus-beta-fetch-${item.id}-`));
    try {
      gh.downloadArtifact(run.databaseId, item.artifactName, temp);
      const payload = findJsonPayload(temp);
      if (!payload) {
        throw new Error(`Downloaded artifact ${item.artifactName} did not contain JSON evidence.`);
      }
      const destination = join(root, item.localPath);
      mkdirSync(join(root, "artifacts"), { recursive: true });
      copyFileSync(payload, destination);
      installed.push({
        id: item.id,
        artifactName: item.artifactName,
        localPath: item.localPath,
        present: existsSync(destination),
      });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  return Object.freeze({
    sha: run.headSha,
    runId: run.databaseId,
    runUrl: run.url ?? null,
    installed: Object.freeze(installed),
  });
}
