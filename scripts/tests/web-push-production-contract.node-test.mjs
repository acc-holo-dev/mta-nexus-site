import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relative) {
  return readFileSync(
    new URL("../../" + relative, import.meta.url),
    "utf8",
  );
}

test("production image contains the durable Web Push worker runtime", () => {
  const dockerfile = read("Dockerfile");

  assert.match(
    dockerfile,
    /run-web-push-dispatcher\.ts/,
  );
  assert.match(
    dockerfile,
    /check-web-push-worker-health\.mjs/,
  );
  assert.match(
    dockerfile,
    /pnpm --filter @nexus\/db --prod deploy \/runtime\/db/,
  );
});

test("production compose runs Web Push as a separate healthy process", () => {
  const compose = read("compose.production.yaml");

  assert.match(compose, /\n  push-worker:\n/);
  assert.match(
    compose,
    /scripts\/run-web-push-dispatcher\.ts/,
  );
  assert.match(
    compose,
    /check-web-push-worker-health\.mjs/,
  );
  assert.match(
    compose,
    /WEB_PUSH_VAPID_PUBLIC_KEY:/,
  );
  assert.match(
    compose,
    /WEB_PUSH_VAPID_PRIVATE_KEY:/,
  );
  assert.match(
    compose,
    /WEB_PUSH_VAPID_SUBJECT:/,
  );
  assert.match(
    compose,
    /push-worker:[\s\S]*?depends_on:[\s\S]*?app:[\s\S]*?condition: service_healthy/,
  );
});
