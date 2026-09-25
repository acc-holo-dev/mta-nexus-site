import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertScenarioEnvironment,
  assertScenarioId,
  isScenarioId,
  scenarioCatalog,
} from "../scenario-lab-contract.mjs";

const canonical = {
  NODE_ENV: "development",
  NEXUS_SCENARIO_LAB: "true",
  GITHUB_ACTIONS: "false",
  EMAIL_PROVIDER: "disabled",
  DATABASE_URL: "postgres://nexus:nexus_secret@postgres:5432/mta_nexus",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

test("scenario catalog is unique, explicit and namespaced by implementation contract", () => {
  const ids = scenarioCatalog.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    "expired-session",
    "private-server-owner",
    "moderation-queue",
    "resource-scan-pending",
  ]);
  assert(ids.every((id) => isScenarioId(id)));
  assert.equal(isScenarioId("production-copy"), false);
});

test("canonical Docker-only development environment is accepted", () => {
  const value = assertScenarioEnvironment(canonical);
  assert.deepEqual(value, {
    databaseHost: "postgres",
    databaseName: "mta_nexus",
    appOrigin: "http://localhost:3000",
  });
});

test("Scenario Lab refuses production and missing explicit opt-in", () => {
  assert.throws(
    () => assertScenarioEnvironment({ ...canonical, NODE_ENV: "production" }),
    /NODE_ENV must be development/u,
  );
  assert.throws(
    () => assertScenarioEnvironment({ ...canonical, NEXUS_SCENARIO_LAB: undefined }),
    /NEXUS_SCENARIO_LAB=true/u,
  );
});

test("Scenario Lab refuses GitHub Actions and enabled email delivery", () => {
  assert.throws(
    () => assertScenarioEnvironment({ ...canonical, GITHUB_ACTIONS: "true" }),
    /not allowed in GitHub Actions/u,
  );
  assert.throws(
    () => assertScenarioEnvironment({ ...canonical, EMAIL_PROVIDER: "smtp" }),
    /EMAIL_PROVIDER must be disabled/u,
  );
});

test("Scenario Lab refuses non-canonical databases even when they look local", () => {
  for (const database of [
    "postgres://nexus:other@postgres:5432/mta_nexus",
    "postgres://nexus:nexus_secret@localhost:5432/mta_nexus",
    "postgres://nexus:nexus_secret@postgres:5432/production",
    "postgres://admin:nexus_secret@postgres:5432/mta_nexus",
  ]) {
    assert.throws(
      () => assertScenarioEnvironment({ ...canonical, DATABASE_URL: database }),
      /canonical local Docker database/u,
    );
  }
});

test("Scenario Lab refuses non-local or credentialed application URLs", () => {
  for (const url of [
    "https://nexus-mta.com",
    "http://example.test:3000",
    "http://user:pass@localhost:3000",
  ]) {
    assert.throws(
      () => assertScenarioEnvironment({ ...canonical, NEXT_PUBLIC_APP_URL: url }),
      /localhost over HTTP/u,
    );
  }
});

test("unknown scenario names are rejected with the available set", () => {
  assert.equal(assertScenarioId("moderation-queue"), "moderation-queue");
  assert.throws(
    () => assertScenarioId("unknown"),
    /Available: expired-session, private-server-owner, moderation-queue, resource-scan-pending/u,
  );
});
