import { describe, expect, it } from "vitest";
import {
  evaluateWebPushSoak,
  readWebPushSoakConfig,
} from "../packages/db/src/repositories/web-push-soak";

describe("Web Push production-duration soak contract", () => {
  it("uses a bounded production-like default configuration", () => {
    expect(readWebPushSoakConfig({})).toEqual({
      durationMs: 900_000,
      workers: 4,
      subscriptions: 4,
      notificationsPerWave: 8,
      waveIntervalMs: 5_000,
      pollMs: 100,
      drainTimeoutMs: 120_000,
      batchLimit: 100,
      retryEvery: 10,
    });
  });

  it("accepts explicit bounded overrides", () => {
    expect(
      readWebPushSoakConfig({
        NEXUS_WEB_PUSH_SOAK_DURATION_MS: "60000",
        NEXUS_WEB_PUSH_SOAK_WORKERS: "2",
        NEXUS_WEB_PUSH_SOAK_SUBSCRIPTIONS: "2",
        NEXUS_WEB_PUSH_SOAK_NOTIFICATIONS_PER_WAVE: "4",
        NEXUS_WEB_PUSH_SOAK_WAVE_INTERVAL_MS: "1000",
        NEXUS_WEB_PUSH_SOAK_POLL_MS: "50",
        NEXUS_WEB_PUSH_SOAK_DRAIN_TIMEOUT_MS: "30000",
        NEXUS_WEB_PUSH_SOAK_BATCH_LIMIT: "40",
        NEXUS_WEB_PUSH_SOAK_RETRY_EVERY: "5",
      }),
    ).toEqual({
      durationMs: 60_000,
      workers: 2,
      subscriptions: 2,
      notificationsPerWave: 4,
      waveIntervalMs: 1_000,
      pollMs: 50,
      drainTimeoutMs: 30_000,
      batchLimit: 40,
      retryEvery: 5,
    });
  });

  it.each([
    ["NEXUS_WEB_PUSH_SOAK_DURATION_MS", "59999"],
    ["NEXUS_WEB_PUSH_SOAK_WORKERS", "9"],
    ["NEXUS_WEB_PUSH_SOAK_SUBSCRIPTIONS", "0"],
    ["NEXUS_WEB_PUSH_SOAK_NOTIFICATIONS_PER_WAVE", "33"],
    ["NEXUS_WEB_PUSH_SOAK_WAVE_INTERVAL_MS", "499"],
    ["NEXUS_WEB_PUSH_SOAK_POLL_MS", "0"],
    ["NEXUS_WEB_PUSH_SOAK_DRAIN_TIMEOUT_MS", "9999"],
    ["NEXUS_WEB_PUSH_SOAK_BATCH_LIMIT", "101"],
    ["NEXUS_WEB_PUSH_SOAK_RETRY_EVERY", "1"],
  ])("rejects unsafe override %s=%s", (key, value) => {
    expect(() => readWebPushSoakConfig({ [key]: value })).toThrow(RangeError);
  });

  it("passes only when the full duration drains exactly once and exercises retry", () => {
    expect(
      evaluateWebPushSoak({
        durationTargetMs: 60_000,
        durationActualMs: 60_100,
        enqueuedJobs: 100,
        acceptedUnique: 100,
        duplicateAccepts: 0,
        finalFixturePending: 0,
        unsettled: 0,
        discarded: 0,
        stale: 0,
        forcedRetries: 10,
        retried: 10,
        maxFixturePending: 40,
        queueCapacity: 10_000,
      }),
    ).toEqual({
      passed: true,
      failures: [],
    });
  });

  it("reports independent reliability failures without hiding others", () => {
    expect(
      evaluateWebPushSoak({
        durationTargetMs: 60_000,
        durationActualMs: 50_000,
        enqueuedJobs: 10,
        acceptedUnique: 8,
        duplicateAccepts: 1,
        finalFixturePending: 2,
        unsettled: 1,
        discarded: 1,
        stale: 0,
        forcedRetries: 0,
        retried: 0,
        maxFixturePending: 101,
        queueCapacity: 100,
      }).failures,
    ).toEqual([
      "duration_shortfall",
      "not_all_jobs_accepted",
      "duplicate_acceptance",
      "fixture_queue_not_drained",
      "unsettled_leases",
      "unexpected_terminal_failures",
      "retry_path_not_exercised",
      "queue_capacity_violation",
    ]);
  });
});
