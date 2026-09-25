import assert from "node:assert/strict";
import { test } from "node:test";

import { assertServerObservationCaptureEnvironment } from "../server-observation-capture-contract.mjs";

const base = {
  NODE_ENV: "development",
  NEXUS_SERVER_OBSERVATION_CAPTURE: "true",
  GITHUB_ACTIONS: "false",
  DATABASE_URL: "postgres://nexus:nexus_secret@postgres:5432/mta_nexus",
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

test("capture is development-only until production collection is accepted", () => {
  assert.doesNotThrow(() =>
    assertServerObservationCaptureEnvironment(base),
  );
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        NODE_ENV: "production",
      }),
    /NODE_ENV must be development/u,
  );
  assert.throws(
    () =>
      assertServerObservationCaptureEnvironment({
        ...base,
        NODE_ENV: "test",
      }),
    /NODE_ENV must be development/u,
  );
});

test("capture refuses non-canonical databases", () => {
  for (const database of [
    "",
    "postgres://nexus:other@postgres:5432/mta_nexus",
    "postgres://nexus:nexus_secret@localhost:5432/mta_nexus",
    "postgres://nexus:nexus_secret@postgres:5432/production",
  ]) {
    assert.throws(
      () =>
        assertServerObservationCaptureEnvironment({
          ...base,
          DATABASE_URL: database,
        }),
      /canonical local Docker database/u,
    );
  }
});
