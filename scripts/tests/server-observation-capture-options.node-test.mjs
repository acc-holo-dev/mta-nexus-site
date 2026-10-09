import assert from "node:assert/strict";
import { test } from "node:test";
import { readServerObservationCaptureOptions } from "../server-observation-capture-options.mjs";

test("defaults to a safe 500-server, one-page capture", () => {
  assert.deepEqual(readServerObservationCaptureOptions({}), {
    limit: 500, maxPages: 1,
  });
});

test("supports explicit multi-page capture and resumable ID cursor", () => {
  assert.deepEqual(readServerObservationCaptureOptions({
    NEXUS_SERVER_OBSERVATION_PAGE_LIMIT: "50",
    NEXUS_SERVER_OBSERVATION_MAX_PAGES: "20",
    NEXUS_SERVER_OBSERVATION_AFTER_ID: "srv_000049",
  }), { limit: 50, maxPages: 20, afterId: "srv_000049" });
});

test("rejects invalid limits and does not silently clamp operator mistakes", () => {
  for (const [key, invalid] of [
    ["NEXUS_SERVER_OBSERVATION_PAGE_LIMIT", "0"],
    ["NEXUS_SERVER_OBSERVATION_PAGE_LIMIT", "-1"],
    ["NEXUS_SERVER_OBSERVATION_PAGE_LIMIT", "501"],
    ["NEXUS_SERVER_OBSERVATION_PAGE_LIMIT", "NaN"],
    ["NEXUS_SERVER_OBSERVATION_PAGE_LIMIT", "2.3"],
    ["NEXUS_SERVER_OBSERVATION_MAX_PAGES", "21"],
    ["NEXUS_SERVER_OBSERVATION_MAX_PAGES", "Infinity"],
    ["NEXUS_SERVER_OBSERVATION_MAX_PAGES", "9007199254740992"],
  ]) assert.throws(() => readServerObservationCaptureOptions({ [key]: invalid }));
});

test("rejects opaque cursors that are empty or contain invalid characters", () => {
  for (const cursor of ["", "not-an-id", "srv_hello world", "srv_../etc", "srv_" + "x".repeat(200)]) {
    assert.throws(() => readServerObservationCaptureOptions({
      NEXUS_SERVER_OBSERVATION_AFTER_ID: cursor,
    }), /AFTER_ID is invalid/u);
  }
});
