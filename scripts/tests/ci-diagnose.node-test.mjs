import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { diagnoseCiRun, githubDiagnosticRequest, parseDiagnosticOptions } from "../ci-diagnose.mjs";

const repository = "acc-holo-dev/mta-nexus-site";
const root = `/repos/${repository}`;
const run = {
  id: 12,
  run_attempt: 3,
  head_sha: "a".repeat(40),
  status: "completed",
  conclusion: "failure",
};
const job = {
  id: 23,
  run_id: 12,
  name: "Choose verification scope",
  status: "completed",
  conclusion: "failure",
  runner_id: 0,
  steps: [],
  check_run_url: `https://api.github.com${root}/check-runs/24`,
};

function fixture({ jobs = [job], annotations = [], denyAnnotations = false, runData = run } = {}) {
  const paths = [];
  return {
    paths,
    request: async (path) => {
      paths.push(path);
      if (path === `${root}/actions/runs/12`) return runData;
      const page = Number(new URL(`https://api.github.com${path}`).searchParams.get("page"));
      if (path.startsWith(`${root}/actions/runs/12/attempts/3/jobs?`)) {
        return { jobs: jobs.slice((page - 1) * 100, page * 100) };
      }
      if (path.startsWith(`${root}/check-runs/24/annotations?`)) {
        if (denyAnnotations) throw new Error("private API diagnostic with a secret");
        return annotations.slice((page - 1) * 100, page * 100);
      }
      throw new Error("Unexpected request");
    },
  };
}

const diagnose = (options) => diagnoseCiRun({ repository, runId: 12, ...options });

test("reads attempt-specific jobs and reports system annotations without guessing a cause", async () => {
  const source = fixture({
    annotations: [{ annotation_level: "failure", title: "Runner", message: "Job could not start" }],
  });
  const report = await diagnose(source);
  assert.equal(report.sha, run.head_sha);
  assert.equal(report.attempt, 3);
  assert.deepEqual(report.failedBeforeSteps, [23]);
  assert.equal(report.jobs[0].runnerAssigned, false);
  assert.equal(report.jobs[0].stepCount, 0);
  assert.equal(report.jobs[0].annotations[0].message, "Job could not start");
  assert.match(report.diagnosis, /do not establish billing/u);
  assert.equal(source.paths.length, 3);
  assert.match(source.paths[1], /attempts\/3\/jobs/u);
});

test("reports an ordinary failed step separately from zero-step failures", async () => {
  const source = fixture({
    jobs: [
      {
        ...job,
        runner_id: 7,
        steps: [
          { number: 1, name: "Checkout", conclusion: "success" },
          { number: 2, name: "Typecheck", conclusion: "failure" },
        ],
      },
    ],
  });
  const report = await diagnose(source);
  assert.deepEqual(report.failedBeforeSteps, []);
  assert.equal(report.jobs[0].runnerAssigned, true);
  assert.deepEqual(report.jobs[0].failedSteps, [{ number: 2, name: "Typecheck" }]);
});

test("does not infer a pre-step failure from unavailable steps, skipped or pending jobs", async () => {
  const source = fixture({
    jobs: [
      { ...job, id: 1, steps: null, runner_id: null },
      { ...job, id: 2, conclusion: "skipped" },
      { ...job, id: 3, conclusion: null, status: "queued" },
    ],
  });
  const report = await diagnose(source);
  assert.deepEqual(report.failedBeforeSteps, []);
  assert.equal(report.jobs[0].stepCount, null);
  assert.equal(report.jobs[0].runnerAssigned, null);
  assert.equal(source.paths.filter((path) => path.includes("annotations")).length, 1);
});

test("paginates both jobs and annotations beyond the first hundred", async () => {
  const jobs = Array.from({ length: 101 }, (_, id) => ({
    ...job,
    id: id + 1,
    conclusion: id === 100 ? "failure" : "success",
  }));
  const annotations = Array.from({ length: 101 }, (_, index) => ({
    message: `System message ${index}`,
  }));
  const source = fixture({ jobs, annotations });
  const report = await diagnose(source);
  assert.equal(report.jobs.length, 101);
  assert.equal(report.jobs[100].annotations.length, 101);
  assert.equal(report.jobs[100].annotations[100].message, "System message 100");
  assert.equal(source.paths.length, 5);
});

test("keeps unavailable annotations explicit without exposing API error bodies", async () => {
  const report = await diagnose(fixture({ denyAnnotations: true }));
  assert.match(report.jobs[0].annotationReadError, /Checks read access/u);
  assert.deepEqual(report.jobs[0].annotations, []);
  assert.ok(!JSON.stringify(report).includes("private API diagnostic"));
});

test("does not request annotation URLs outside the chosen repository", async () => {
  const source = fixture({
    jobs: [{ ...job, check_run_url: "https://attacker.invalid/check-runs/24" }],
  });
  const report = await diagnose(source);
  assert.equal(source.paths.length, 2);
  assert.equal(report.jobs[0].annotationReadError, "Check run identity unavailable");
});

test("redacts configured tokens from annotation and job text", async () => {
  const secret = "never-print-this-token";
  const report = await diagnose({
    ...fixture({
      jobs: [{ ...job, name: secret }],
      annotations: [{ title: secret, message: `Token ${secret}` }],
    }),
    secrets: [secret],
  });
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.match(report.jobs[0].annotations[0].message, /\[redacted\]/u);
});

test("rejects mismatched run/job identities and invalid collections", async () => {
  await assert.rejects(diagnose(fixture({ runData: { ...run, id: 99 } })), /run identity/u);
  await assert.rejects(diagnose(fixture({ jobs: [{ ...job, run_id: 99 }] })), /job identity/u);
  await assert.rejects(
    diagnose({ request: async (path) => (path.endsWith("/12") ? run : {}) }),
    /collection is invalid/u,
  );
});

test("refuses an incomplete job report at the pagination cap", async () => {
  let pages = 0;
  await assert.rejects(
    diagnose({
      request: async (path) => {
        if (path.endsWith("/12")) return run;
        pages += 1;
        return { jobs: Array.from({ length: 100 }, () => job) };
      },
    }),
    /pagination limit/u,
  );
  assert.equal(pages, 20);
});

test("uses only GET on GitHub with a timeout and refuses credential redirects", async () => {
  const token = "never-print-this-token";
  let captured;
  const request = githubDiagnosticRequest({
    token,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify(run));
    },
  });
  assert.deepEqual(await request(`${root}/actions/runs/12`), run);
  assert.equal(captured.url, `https://api.github.com${root}/actions/runs/12`);
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.headers.Authorization, `Bearer ${token}`);
  assert.ok(captured.options.signal instanceof AbortSignal);
  await assert.rejects(request("https://attacker.invalid"), /Invalid GitHub API path/u);
});

test("network, HTTP and JSON failures expose no response body or token", async () => {
  for (const fetchImpl of [
    async () => {
      throw new Error("never-print-this-token");
    },
    async () => new Response("never-print-this-token", { status: 403 }),
    async () => new Response("never-print-this-token"),
  ]) {
    const request = githubDiagnosticRequest({ fetchImpl });
    await assert.rejects(
      request(`${root}/actions/runs/12`),
      (error) => !error.message.includes("never-print-this-token"),
    );
  }
});

test("validates CLI arguments before any network access", () => {
  assert.equal(parseDiagnosticOptions(["--run-id", "12"]).repository, repository);
  assert.equal(parseDiagnosticOptions(["--help"]).help, true);
  for (const args of [
    [],
    ["--run-id", "0"],
    ["--run-id", "NaN"],
    ["--run-id", "12", "--repository", "x/y/z"],
    ["--unknown"],
  ]) {
    assert.throws(() => parseDiagnosticOptions(args));
  }
  const result = spawnSync(process.execPath, ["scripts/ci-diagnose.mjs", "--run-id", "invalid"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, GH_TOKEN: "never-print-this-token" },
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.ok(!result.stderr.includes("never-print-this-token"));
});
