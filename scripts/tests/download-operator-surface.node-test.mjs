import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const hashCancellation = new URL("../check-download-hash-cancellation.mjs", import.meta.url);
const downloadNetwork = new URL("../check-download-network.mjs", import.meta.url);

function run(script, { env = {}, cwd = process.cwd() } = {}) {
  const result = spawnSync(process.execPath, [script.pathname], {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...env,
    },
    timeout: 5_000,
  });
  assert.ifError(result.error);
  return result;
}

test("hash-cancellation probe refuses to start without disposable-ci marker", () => {
  const result = run(hashCancellation, {
    env: {
      NEXUS_HASH_PROBE: "not-disposable",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXUS_HASH_PROBE|AssertionError/u);
});

test("hash-cancellation probe refuses a non-production web working directory", () => {
  const result = run(hashCancellation, {
    env: {
      NEXUS_HASH_PROBE: "disposable-ci",
    },
    cwd: process.cwd(),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\/app\/site|AssertionError/u);
});

test("download-network probe refuses hosts outside disposable GitHub Actions", () => {
  const missingActions = run(downloadNetwork);
  assert.notEqual(missingActions.status, 0);
  assert.match(missingActions.stderr, /GITHUB_ACTIONS|AssertionError/u);

  const wrongRunner = run(downloadNetwork, {
    env: {
      GITHUB_ACTIONS: "true",
      RUNNER_ENVIRONMENT: "self-hosted",
      NEXUS_BROWSER_BASE_URL: "https://nexus-ci.test:8443",
    },
  });
  assert.notEqual(wrongRunner.status, 0);
  assert.match(wrongRunner.stderr, /RUNNER_ENVIRONMENT|AssertionError/u);
});

test("download-network probe refuses remote Docker host or context overrides", () => {
  const withDockerHost = run(downloadNetwork, {
    env: {
      GITHUB_ACTIONS: "true",
      RUNNER_ENVIRONMENT: "github-hosted",
      NEXUS_BROWSER_BASE_URL: "https://nexus-ci.test:8443",
      DOCKER_HOST: "tcp://remote.example:2376",
    },
  });
  assert.notEqual(withDockerHost.status, 0);
  assert.match(withDockerHost.stderr, /DOCKER_HOST|AssertionError/u);

  const withDockerContext = run(downloadNetwork, {
    env: {
      GITHUB_ACTIONS: "true",
      RUNNER_ENVIRONMENT: "github-hosted",
      NEXUS_BROWSER_BASE_URL: "https://nexus-ci.test:8443",
      DOCKER_CONTEXT: "remote",
    },
  });
  assert.notEqual(withDockerContext.status, 0);
  assert.match(withDockerContext.stderr, /DOCKER_CONTEXT|AssertionError/u);
});
