import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  enqueue: vi.fn(),
  clock: "2026-10-12T00:00:00.000Z",
}));
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: state.enqueue,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('AS "observedAt"')) return { rows: [{ observedAt: state.clock }] };
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(db);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
});
import { builds, resourceReleaseEvents } from "../packages/db/src/schema";
import { buildRepository } from "../packages/db/src/repositories/builds";
import { resourceReleaseWorkerRepository as worker } from "../packages/db/src/repositories/resource-release-worker";
function event() {
  const values: Record<string, unknown> = {
    sequence: "9007199254740993",
    productId: "prd_a",
    buildId: "bld_a",
    version: "2.0.0",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    createdAt: "2026-10-11T00:00:00Z",
  };
  return Object.keys(getTableColumns(resourceReleaseEvents)).map((key) => values[key]);
}
function rows(enabled = true, safe = true) {
  return [
    [],
    [],
    [["usr_a", "prd_a"]],
    [["prd_a", "Public resource", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [[1, "9007199254740992"]],
    [event()],
    safe ? [["bld_a"]] : [],
    [],
    [[enabled]],
    ...(enabled && safe ? [[]] : []),
    [["prd_a"]],
    [],
  ];
}
beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [];
  state.clock = "2026-10-12T00:00:00.000Z";
  state.enqueue.mockResolvedValue({ queued: 2, reason: "queued" });
});
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

it.each(["approve", "reject"] as const)(
  "moderation persists release work only for a successful approval (%s)",
  async (decision) => {
    const artifact: Record<string, unknown> = {
      id: "bld_a",
      productId: "prd_a",
      version: "2.0.0",
      status: decision === "approve" ? "published" : "rejected",
      revision: 4,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
      createdAt: "2026-10-11T00:00:00Z",
      scannedAt: "2026-10-11T00:00:00Z",
    };
    state.rows = [
      [["prd_a"]],
      [["prd_a", "published", "usr_a", null, false]],
      [["moderator"]],
      [["ses_staff", "2099-01-01T00:00:00.000Z"]],
      [Object.keys(getTableColumns(builds)).map((key) => artifact[key] ?? null)],
      [["prd_a", "Resource", "usr_a", null]],
      decision === "approve" ? [["bld_a", "2.0.0"]] : [],
      [],
      [],
      [],
      [],
      [],
    ];
    const audit = {
      id: "aud_a",
      actorId: "usr_staff",
      actorType: "user" as const,
      action: "build.reviewed",
      targetType: "build",
      targetId: "bld_a",
    };
    expect(
      await buildRepository.moderatePending("bld_a", decision, audit, 3, "staff-session"),
    ).toMatchObject({
      id: "bld_a",
    });
    const event = state.queries.find((query) =>
      query.sql.startsWith('insert into "resource_release_events"'),
    );
    if (decision === "approve") {
      expect(event?.params).toEqual(["prd_a", "bld_a", "2.0.0", "a".repeat(64), 7]);
      expect(event?.sql).toContain('on conflict ("build_id") do nothing');
      expect(state.queries.at(-1)).toBe(event);
    } else expect(event).toBeUndefined();
    expect(state.queries.some((query) => query.sql.startsWith('insert into "audit_events"'))).toBe(
      true,
    );
  },
);

it("a stale moderation decision creates no release work, inbox or audit", async () => {
  state.rows = [
    [["prd_a"]],
    [["prd_a", "published", "usr_a", null, false]],
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [],
  ];
  expect(
    await buildRepository.moderatePending(
      "bld_a",
      "approve",
      {
        id: "aud_a",
        actorId: "usr_staff",
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: "bld_a",
      },
      3,
      "staff-session",
    ),
  ).toBeNull();
  expect(state.queries).toHaveLength(5);
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
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
