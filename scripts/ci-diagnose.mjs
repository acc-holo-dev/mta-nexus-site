import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "acc-holo-dev/mta-nexus-site";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export function parseDiagnosticOptions(args) {
  const options = { repository: DEFAULT_REPOSITORY, runId: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--help") options.help = true;
    else if (flag === "--repository") options.repository = args[++index];
    else if (flag === "--run-id") options.runId = Number(args[++index]);
    else throw new Error("Unknown option; use --help");
  }
  if (options.help) return options;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repository ?? "")) {
    throw new Error("Repository must be owner/name");
  }
  if (!Number.isSafeInteger(options.runId) || options.runId <= 0) {
    throw new Error("A positive --run-id is required");
  }
  return options;
}

export function githubDiagnosticRequest({ token, fetchImpl = fetch } = {}) {
  return async (path) => {
    // Only generated relative API paths are accepted; credentials stay on GitHub.
    if (!/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\//u.test(path) || path.includes("..")) {
      throw new Error("Invalid GitHub API path");
    }
    let response;
    try {
      response = await fetchImpl(`https://api.github.com${path}`, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      throw new Error("GitHub request failed or timed out");
    }
    if (!response.ok)
      throw new Error(`GitHub HTTP ${response.status}; verify read access and API limits`);
    try {
      return await response.json();
    } catch {
      throw new Error("GitHub returned invalid JSON");
    }
  };
}

async function paginated(path, request, field) {
  const results = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await request(
      `${path}${path.includes("?") ? "&" : "?"}per_page=${PAGE_SIZE}&page=${page}`,
    );
    const items = field ? data?.[field] : data;
    if (!Array.isArray(items)) throw new Error("GitHub collection is invalid");
    results.push(...items);
    if (items.length < PAGE_SIZE) return results;
  }
  throw new Error("GitHub pagination limit reached; report would be incomplete");
}

export async function diagnoseCiRun({ repository, runId, request, secrets = [] }) {
  // Validate programmatic callers as well as the CLI.
  parseDiagnosticOptions(["--repository", repository, "--run-id", String(runId)]);
  const root = `/repos/${repository}`;
  const run = await request(`${root}/actions/runs/${runId}`);
  if (
    run?.id !== runId ||
    !/^[a-f0-9]{40}$/u.test(run.head_sha ?? "") ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1
  ) {
    throw new Error("GitHub run identity is invalid");
  }
  // Pin the attempt so a concurrent rerun cannot mix old and new job evidence.
  const jobs = await paginated(
    `${root}/actions/runs/${runId}/attempts/${run.run_attempt}/jobs`,
    request,
    "jobs",
  );
  const summaries = [];
  const redact = (value) => {
    let text = String(value ?? "");
    for (const secret of secrets) if (secret) text = text.replaceAll(secret, "[redacted]");
    return text;
  };
  for (const job of jobs) {
    if (job.run_id !== runId || !Number.isSafeInteger(job.id))
      throw new Error("GitHub job identity is invalid");
    const steps = Array.isArray(job.steps) ? job.steps : null;
    const failed = job.conclusion === "failure";
    const summary = {
      id: job.id,
      name: redact(job.name),
      status: job.status,
      conclusion: job.conclusion,
      runnerAssigned: Number.isSafeInteger(job.runner_id) ? job.runner_id > 0 : null,
      stepCount: steps?.length ?? null,
      failedBeforeSteps: failed && steps?.length === 0,
      failedSteps: (steps ?? [])
        .filter((step) => step.conclusion === "failure")
        .map((step) => ({ number: step.number, name: redact(step.name) })),
      annotations: [],
      annotationReadError: null,
    };
    if (failed) {
      const prefix = `https://api.github.com${root}/check-runs/`;
      const checkId =
        typeof job.check_run_url === "string" && job.check_run_url.startsWith(prefix)
          ? job.check_run_url.slice(prefix.length)
          : "";
      if (!/^[1-9]\d*$/u.test(checkId))
        summary.annotationReadError = "Check run identity unavailable";
      else {
        try {
          const annotations = await paginated(`${root}/check-runs/${checkId}/annotations`, request);
          summary.annotations = annotations.map((annotation) => ({
            level: annotation.annotation_level,
            title: redact(annotation.title),
            message: redact(annotation.message),
          }));
        } catch {
          summary.annotationReadError =
            "Annotations unavailable; verify Checks read access and API limits";
        }
      }
    }
    summaries.push(summary);
  }
  return {
    repository,
    runId,
    attempt: run.run_attempt,
    sha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    url: `https://github.com/${repository}/actions/runs/${runId}`,
    jobs: summaries,
    failedBeforeSteps: summaries.filter((job) => job.failedBeforeSteps).map((job) => job.id),
    diagnosis: summaries.some((job) => job.failedBeforeSteps)
      ? "Failure before steps; inspect system annotations. Empty steps alone do not establish billing, quota or runner outage."
      : "Inspect job conclusions and failed steps; this report is not release acceptance evidence.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseDiagnosticOptions(process.argv.slice(2));
    if (options.help) {
      console.log(
        "Usage: pnpm ci:diagnose --run-id ID [--repository owner/name]\nRead-only GitHub diagnostics. Use GH_TOKEN or GITHUB_TOKEN with Actions/Checks read access.\nExit codes: 0 successful run, 1 unsuccessful completed run, 2 pending run or collection error.",
      );
    } else {
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
      const report = await diagnoseCiRun({
        ...options,
        request: githubDiagnosticRequest({ token }),
        secrets: [process.env.GH_TOKEN, process.env.GITHUB_TOKEN],
      });
      console.log(JSON.stringify(report, null, 2));
      process.exitCode =
        report.status !== "completed" ? 2 : report.conclusion === "success" ? 0 : 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "CI diagnostics failed");
    process.exitCode = 2;
  }
}
