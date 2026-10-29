import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  push: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  const database: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(database);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: database };
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: state.push,
}));
import { LicenseMaintenanceRepository } from "../packages/db/src/repositories/license-maintenance";
import { LicenseRepository } from "../packages/db/src/repositories/licenses";
const repo = new LicenseMaintenanceRepository(),
  now = "2026-10-11T04:00:00.000Z",
  past = "2026-10-10T04:00:00.000Z",
  future = "2026-10-12T04:00:00.000Z";
const clock = (expired: boolean) => [{ now, expired }] as unknown as unknown[][];
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.push.mockReset().mockResolvedValue({ queued: 2, reason: "queued" });
});
it("takes an expired finite parent with skip-locked, revokes its token, and records one atomic event and inbox notice", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "active", past]],
    clock(true),
    [],
    [],
    [],
    [[true]],
    [],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toEqual({
    processed: 1,
    expired: 1,
    warned: 0,
    inbox: 1,
    pushJobs: 2,
  });
  const selection = state.queries[2];
  for (const fragment of [
    "isfinite",
    "not exists",
    "license_term_events",
    "for no key update skip locked",
  ])
    expect(selection.sql.toLowerCase()).toContain(fragment);
  expect(selection.params.at(-1)).toBe(1);
  expect(state.queries.find((q) => q.sql.startsWith('update "licenses"'))?.params).toContain(
    "expired",
  );
  const tokens = state.queries.find((q) => q.sql.startsWith('update "license_runtime_bindings"'));
  for (const field of ["token_digest", "token_issued_at", "token_expires_at"])
    expect(tokens?.sql).toContain(`"${field}" =`);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.sql,
  ).toContain('(select "licenses"."expires_at"');
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'))?.params,
  ).toContain("license.expired");
  expect(
    state.queries
      .filter((q) => q.sql.startsWith('update "licenses"'))
      .every((q) => !q.sql.includes('"expires_at" =')),
  ).toBe(true);
  expect(
    state.queries.every(
      (q) => !/^insert into "(payments|orders|ledger_entries|entitlements)"/u.test(q.sql),
    ),
  ).toBe(true);
});
it("warns once without mutating license, binding or original expiry", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "active", future]],
    clock(false),
    [],
    [],
    [],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toMatchObject({ warned: 1, expired: 0, inbox: 1 });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.params,
  ).toContain("expiring");
});
it("records opted-out processing without inbox/push and retains the suppression decision", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "suspended", past]],
    clock(true),
    [],
    [],
    [],
    [[false]],
    [],
    [],
  ];
  expect(await repo.runBatch(1)).toMatchObject({ expired: 1, inbox: 0, pushJobs: 0 });
  expect(state.push).not.toHaveBeenCalled();
  expect(state.queries.some((q) => q.sql.startsWith('insert into "notifications"'))).toBe(false);
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "license_term_events"'))?.params,
  ).toContain(false);
});
it("preserves inbox processing on optional push failure but propagates intent failure", async () => {
  state.results = [
    [],
    [],
    [["lic_a", "usr_a", "expired", past]],
    clock(true),
    [],
    [],
    [[true]],
    [],
    [],
    [],
  ];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  const pending = [...state.results];
  expect(await repo.runBatch(1)).toMatchObject({ expired: 1, inbox: 1, pushJobs: 0 });
  expect(state.queries.some((q) => q.sql.startsWith('update "licenses"'))).toBe(false);
  state.results = pending;
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(repo.runBatch(1)).rejects.toThrow("Admission intent failed");
});
it("bounds mutation work and does nothing for an empty queue or an aborted batch", async () => {
  for (const limit of [0, 101, 1.5, Number.NaN])
    await expect(repo.runBatch(limit)).rejects.toThrow();
  const abort = new AbortController();
  abort.abort();
  expect(await repo.runBatch(20, abort.signal)).toMatchObject({ processed: 0 });
  expect(state.queries).toHaveLength(0);
  state.results = [[], [], []];
  expect(await repo.runBatch()).toMatchObject({ processed: 0 });
  expect(state.queries).toHaveLength(3);
});
it("requires current admin authority before exposing the maintenance queue", async () => {
  state.results = [[["moderator"]]];
  await expect(repo.preview("usr_a")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain("for share");
});
it("paginates operator metadata without keys, recipients, token digests or endpoint addresses", async () => {
  state.results = [
    [["admin"]],
    [[41, 30, 11]],
    [[5]],
    [["lic_a", "Resource", "active", past, "expired"]],
  ];
  expect(await repo.preview("usr_a", 2)).toMatchObject({
    page: 2,
    expired: 30,
    expiring: 11,
    unknownTerms: 5,
  });
  const query = state.queries.at(-1);
  for (const field of ['"key"', '"user_id"', '"token_digest"', '"ip_address"'])
    expect(query?.sql).not.toContain(field);
  expect(query?.params.slice(-2)).toEqual([20, 20]);
});
it("filters the buyer archive with current effective expiry, durable bindings and literal search", async () => {
  state.results = [
    [[41]],
    [["lic_a", "Resource", "active", "expired", "single_server", past, now, true]],
  ];
  const result = await new LicenseRepository().pageUserHistory("usr_a", 2, {
    status: "expired",
    binding: "bound",
    term: "finite",
    sort: "expires_soon",
    q: "100%_",
  });
  expect(result).toMatchObject({
    page: 2,
    licenses: [{ effectiveStatus: "expired", serverBound: true }],
  });
  const query = state.queries.at(-1);
  expect(query?.params).toEqual(expect.arrayContaining(["usr_a", "expired", "%100\\%\\_%", 20]));
  for (const fragment of [
    "clock_timestamp",
    "isfinite",
    "license_runtime_bindings",
    "asc nulls last",
  ])
    expect(query?.sql).toContain(fragment);
  for (const field of ['"licenses"."key"', '"token_digest"', '"entitlements"'])
    expect(query?.sql).not.toContain(field);
});
