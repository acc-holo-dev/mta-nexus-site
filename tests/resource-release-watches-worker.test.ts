import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { resourceReleaseWatchesWorkerState } = await import(
    "./helpers/resource-release-watches-worker-harness"
  );
  return { enqueueWebPushWithRecoveryWithin: resourceReleaseWatchesWorkerState.enqueue };
});

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchesWorkerDbMock } = await import(
    "./helpers/resource-release-watches-worker-harness"
  );
  return createResourceReleaseWatchesWorkerDbMock();
});

import { resourceReleaseWorkerRepository as worker } from "../packages/db/src/repositories/resource-release-worker";
import {
  installResourceReleaseWatchesWorkerHooks,
  resourceReleaseWatchesWorkerEvent as event,
  resourceReleaseWatchesWorkerRows as rows,
  resourceReleaseWatchesWorkerState as state,
} from "./helpers/resource-release-watches-worker-harness";

installResourceReleaseWatchesWorkerHooks();

it("atomically processes one exact release with current rights, preference lock, inbox, progress and audit", async () => {
  state.rows = rows();
  const result = await worker.runBatch(1);
  expect(result).toMatchObject({ examined: 1, processed: 1, notified: 1, pushJobs: 2 });
  const notification = state.queries.find((q) => q.sql.startsWith('insert into "notifications"'));
  expect(notification?.params).toContain("ntf_release_9007199254740993_usr_a");
  expect(notification?.params).toContain("commerce");
  expect(state.queries[3].sql).toContain("for share skip locked");
  expect(state.queries[4].sql).toContain("for share skip locked");
  expect(state.queries[6].sql).toContain("for no key update skip locked");
  expect(state.queries[8].sql).toContain("scanned_at");
  expect(state.queries[8].params).toContain("bld_a");
  const progress = state.queries.find((q) => q.sql.startsWith('update "resource_release_watches"'));
  expect(progress?.params).toContain(9007199254740993n);
  expect(state.queries.at(-1)?.params).toContain("library.release_notice_processed");
});
it.each([
  [false, true],
  [true, false],
])(
  "consumes disabled preferences or unavailable exact releases without notification (%s %s)",
  async (enabled, safe) => {
    state.rows = rows(enabled, safe);
    expect(await worker.runBatch(1)).toMatchObject({
      processed: 1,
      notified: 0,
      skipped: 1,
      disabled: 0,
    });
    expect(state.queries.some((q) => q.sql.startsWith('insert into "notifications"'))).toBe(false);
    expect(state.enqueue).not.toHaveBeenCalled();
  },
);
it("revoked access disables a watch and advances its revision without notifying", async () => {
  state.rows = [
    [],
    [],
    [["usr_a", "prd_a"]],
    [["prd_a", "Public resource", "published"]],
    [["usr_a"]],
    [],
    [],
    [[1, "9007199254740992"]],
    [event()],
    [["bld_a"]],
    [],
    [],
    [["prd_a"]],
    [],
  ];
  expect(await worker.runBatch(1)).toMatchObject({ processed: 1, notified: 0, disabled: 1 });
  const progress = state.queries.find((q) => q.sql.startsWith('update "resource_release_watches"'));
  expect(progress?.params).toContain(false);
  expect(progress?.params).toContain(2);
});
it("optional push degradation preserves progress while intent failure aborts processing", async () => {
  state.rows = rows();
  const pending = [...state.rows];
  state.enqueue.mockResolvedValueOnce({ queued: 0, reason: "error" });
  expect(await worker.runBatch(1)).toMatchObject({
    processed: 1,
    notified: 1,
    pushJobs: 0,
    pushDegraded: 1,
  });
  expect(state.queries.at(-1)?.params).toContain("library.release_notice_processed");
  state.rows = pending;
  state.queries = [];
  state.enqueue.mockRejectedValueOnce(new Error("Admission intent failed"));
  await expect(worker.runBatch(1)).rejects.toThrow("Admission intent failed");
  expect(state.queries.some((q) => q.sql.startsWith('update "resource_release_watches"'))).toBe(
    false,
  );
});
it("skips locked scopes and excludes them when looking for subsequent work", async () => {
  state.rows = [[], [], [["usr_a", "prd_a"]], [], [], [], []];
  expect(await worker.runBatch(2)).toMatchObject({ examined: 1, processed: 0, skipped: 1 });
  expect(state.queries.at(-1)?.sql).toContain("not (");
  expect(state.queries.at(-1)?.params).toContain("usr_a");
});
it("checks bounds and stops before any transaction when shutdown is requested", async () => {
  await expect(worker.runBatch(101)).rejects.toThrow("Invalid");
  expect(await worker.runBatch(20, AbortSignal.abort())).toMatchObject({
    examined: 0,
    processed: 0,
  });
  expect(state.queries).toHaveLength(0);
});
it("uses the database clock after preference locking when a grant expires while waiting", async () => {
  state.rows = rows();
  state.rows[5] = [["ent_a", "2026-10-12T00:00:00Z"]];
  state.rows.splice(11, 1); // No notification insert when the final grant is expired.
  expect(await worker.runBatch(1)).toMatchObject({ processed: 1, notified: 0, disabled: 1 });
  expect(state.enqueue).not.toHaveBeenCalled();
  const clockIndex = state.queries.findIndex((q) => q.sql.includes('AS "observedAt"'));
  const preferenceIndex = state.queries.findIndex((q) =>
    q.sql.includes('from "notification_preferences"'),
  );
  expect(clockIndex).toBeGreaterThan(preferenceIndex);
  expect(state.queries.find((q) => q.sql.includes('from "entitlements"'))?.sql).toContain(
    "clock_timestamp()",
  );
  const update = state.queries.find((q) => q.sql.startsWith('update "resource_release_watches"'));
  expect(update?.sql).toContain("greatest");
  expect(update?.sql).toContain('"last_sequence" =');
  expect(update?.sql).toContain('"revision" =');
});
it("does not emit a processing audit when guarded progress cannot be saved", async () => {
  state.rows = rows();
  state.rows[12] = [];
  await expect(worker.runBatch(1)).rejects.toThrow("Release progress changed");
  expect(state.queries.some((q) => q.sql.startsWith('insert into "audit_events"'))).toBe(false);
});
it("fails closed when the database clock cannot be read", async () => {
  state.rows = rows();
  state.clock = "invalid";
  await expect(worker.runBatch(1)).rejects.toThrow("Release clock unavailable");
  expect(state.enqueue).not.toHaveBeenCalled();
  expect(state.queries.some((q) => q.sql.startsWith('insert into "notifications"'))).toBe(false);
});
