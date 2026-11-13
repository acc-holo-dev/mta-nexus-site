import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relative) {
  return readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
}

test("production image contains the durable Web Push worker runtime", () => {
  const dockerfile = read("deploy/Dockerfile");

  assert.match(dockerfile, /run-web-push-dispatcher\.ts/);
  assert.match(dockerfile, /check-web-push-worker-health\.mjs/);
  assert.match(dockerfile, /pnpm --filter @nexus\/db --prod deploy \/runtime\/db/);
});

test("production compose runs Web Push as a separate healthy process", () => {
  const compose = read("deploy/compose.production.yaml");

  assert.match(compose, /\n {2}push-worker:\n/);
  assert.match(compose, /scripts\/run-web-push-dispatcher\.ts/);
  assert.match(compose, /check-web-push-worker-health\.mjs/);
  assert.match(compose, /WEB_PUSH_VAPID_PUBLIC_KEY:/);
  assert.match(compose, /WEB_PUSH_VAPID_PRIVATE_KEY:/);
  assert.match(compose, /WEB_PUSH_VAPID_SUBJECT:/);
  assert.match(
    compose,
    /push-worker:[\s\S]*?depends_on:[\s\S]*?app:[\s\S]*?condition: service_healthy/,
  );
});

test("OPS-15 license and resource-release workers share push-worker hardening without changing commands", () => {
  const compose = read("deploy/compose.production.yaml");
  for (const name of ["push-worker", "license-worker", "resource-release-worker"]) {
    const block = compose.match(
      new RegExp(`\\n {2}${name}:\\n([\\s\\S]*?)(?=\\n {2}[a-z]|\\nvolumes:)`, "u"),
    );
    assert.ok(block, `${name} service missing`);
    const body = block[1];
    assert.match(body, /^\s+read_only:\s*true$/mu);
    assert.match(body, /^\s+cap_drop:\n\s+- ALL$/mu);
    assert.match(body, /no-new-privileges:true/u);
    assert.match(body, /^\s+pids_limit:\s*128$/mu);
    assert.match(body, /^\s+stop_signal:\s*SIGTERM$/mu);
    assert.match(body, /^\s+stop_grace_period:\s*75s$/mu);
    assert.match(body, /\/tmp:rw,noexec,nosuid,nodev,size=16m,mode=1777/u);
    assert.match(body, /^\s+HOME:\s*\/tmp$/mu);
    assert.match(body, /^\s+TMPDIR:\s*\/tmp$/mu);
    assert.match(body, /^\s+init:\s*true$/mu);
  }
  assert.match(compose, /run-license-maintenance\.ts", "--loop"/u);
  assert.match(compose, /run-resource-release-worker\.ts", "--loop"/u);
  assert.match(read("site/packages/db/scripts/run-license-maintenance.ts"), /SIGTERM/u);
  assert.match(read("site/packages/db/scripts/run-resource-release-worker.ts"), /SIGTERM/u);
  assert.match(
    read("scripts/check-license-worker-health.mjs"),
    /\/tmp\/nexus-license-worker-health\.json/u,
  );
  assert.match(
    read("scripts/check-resource-release-worker-health.mjs"),
    /\/tmp\/nexus-resource-release-worker-health\.json/u,
  );
});
