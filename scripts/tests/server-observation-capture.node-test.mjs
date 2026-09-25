import assert from "node:assert/strict";
import { test } from "node:test";

import { assertServerObservationCaptureEnvironment } from "../server-observation-capture-contract.mjs";

const base = {
  NODE_ENV: "development",
  NEXUS_SERVER_OBSERVATION_CAPTURE: "true",
  GITHUB_ACTIONS: "false",
  DATABASE_URL: "postgres://nexus:local@postgres:5432/mta_nexus",
};

test("capture requires explicit opt-in before application imports", () => {
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        NEXUS_SERVER_OBSERVATION_CAPTURE: undefined,
      }),
    /set NEXUS_SERVER_OBSERVATION_CAPTURE=true/u,
  );
});

test("capture refuses GitHub Actions", () => {
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        GITHUB_ACTIONS: "true",
      }),
    /not allowed in GitHub Actions/u,
  );
});

test("capture accepts only development or production runtime modes", () => {
  assert.doesNotThrow(() =>
    assertServerObservationCaptureEnvironment(base),
  );
  assert.doesNotThrow(() =>
    assertServerObservationCaptureEnvironment({
      ...base,
      NODE_ENV: "production",
    }),
  );
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        NODE_ENV: "test",
      }),
    /NODE_ENV must be development or production/u,
  );
});

test("capture requires an explicit database URL", () => {
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        DATABASE_URL: "",
      }),
    /DATABASE_URL is required/u,
  );
});
