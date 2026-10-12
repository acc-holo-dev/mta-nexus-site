import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  clock: "2026-10-12T00:00:00.000Z",
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.startsWith("set local")) return { rows: [] };
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
import { resourceReleaseWatchesRepository as repo } from "../packages/db/src/repositories/resource-release-watches";
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.clock = "2026-10-12T00:00:00.000Z";
});
it("enrolls at the latest committed release with held live grants, serialized quota and atomic audit", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[2]],
    [["9007199254740993"]],
    [["prd_a", true, 1, "2026-10-11T00:00:00Z"]],
    [],
  ];
  const result = await repo.command({
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  });
  expect(result).toMatchObject({ productId: "prd_a", enabled: true, revision: 1 });
  expect(result).not.toHaveProperty("lastSequence");
  expect(state.queries[2].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[5].sql).toContain("for share");
  const insert = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(insert?.params).toContain(9007199254740993n);
  expect(state.queries.at(-1)?.params).toContain("library.release_watch_changed");
});
it("allows a user to stop their watch after access is revoked, and handles a replay without writes", async () => {
  state.rows = [
    [],
    [["prd_a", "suspended"]],
    [["usr_a"]],
    [["prd_a", true, 1, "2026-10-11T00:00:00Z", "4"]],
    [["5"]],
    [["prd_a", false, 2, "2026-10-11T00:01:00Z"]],
    [],
  ];
  const input = {
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: false, expectedRevision: 1 },
    auditId: "aud_a",
  };
  expect(await repo.command(input)).toMatchObject({ enabled: false, revision: 2 });
  expect(state.queries.some((q) => q.sql.includes('from "entitlements"'))).toBe(false);
  state.queries = [];
  state.rows = [
    [],
    [["prd_a", "suspended"]],
    [["usr_a"]],
    [["prd_a", false, 2, "2026-10-11T00:01:00Z", "5"]],
  ];
  expect(await repo.command(input)).toMatchObject({ enabled: false, revision: 2 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("refuses enrollment without access, missing publication and quota overflow", async () => {
  const input = {
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  };
  state.rows = [[], [["prd_a", "published"]], [["usr_a"]], [], []];
  await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[100]],
  ];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_LIMIT" });
  state.rows = [[], [["prd_a", "draft"]], [["usr_a"]], [["ent_a", null]]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
});
it("stale revisions cannot overwrite another user's later preference", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [["prd_a", false, 3, "2026-10-11T00:00:00Z", "4"]],
  ];
  await expect(
    repo.command({
      userId: "usr_a",
      productId: "prd_a",
      command: { enabled: true, expectedRevision: 1 },
      auditId: "aud_a",
    }),
  ).rejects.toMatchObject({ code: "RELEASE_WATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("bounds list counts and suppresses unavailable metadata without exposing progress or account IDs", async () => {
  state.rows = [[[26, 23, 3, 4]], []];
  expect(await repo.page("usr_a", 2, "enabled")).toMatchObject({
    counts: { all: 26, enabled: 23 },
    page: 2,
    pageSize: 20,
  });
  const query = state.queries.at(-1);
  if (!query) throw new Error("Missing watch list");
  expect(query.params).toContain("usr_a");
  expect(query.params.slice(-2)).toEqual([20, 20]);
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("entitlements");
  expect(query.sql).toContain("scanner");
  const projection = query.sql.slice(0, query.sql.indexOf(' from "resource_release_watches" left'));
  expect(projection).not.toContain('"resource_release_watches"."last_sequence"');
  expect(projection).not.toContain("storage_key");
});

it("searches literal accessible titles using one database-time snapshot", async () => {
  state.rows = [[[0, 0, 0, 0]], []];
  await repo.page("usr_a", 1, "all", String.raw`a%_\z`);
  for (const query of state.queries) {
    expect(query.sql).toContain("transaction_timestamp()");
    expect(query.sql).toContain("ilike");
    expect(query.params).toContain(String.raw`%a\%\_\\z%`);
  }
});

it("rejects malformed direct commands before acquiring any database lock", async () => {
  for (const command of [
    { enabled: "yes", expectedRevision: 0 },
    { enabled: true, expectedRevision: -1 },
    { enabled: true, expectedRevision: 2147483647 },
    { enabled: true, expectedRevision: 0, lastSequence: "8" },
  ]) {
    await expect(
      repo.command({
        userId: "usr_a",
        productId: "prd_a",
        command: command as never,
        auditId: "aud_a",
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_INVALID" });
  }
  expect(state.queries).toHaveLength(0);
});
it("checks a finite grant at database time after the final locks, including a replay", async () => {
  const input = {
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  };
  for (const replay of [false, true]) {
    state.queries = [];
    state.rows = [
      [],
      [["prd_a", "published"]],
      [["usr_a"]],
      [["ent_a", "2026-10-12T00:00:00Z"]],
      [["bld_a"]],
      replay ? [["prd_a", true, 1, "2026-10-11T00:00:00Z", "4"]] : [],
      ...(!replay ? [[[2]], [["5"]]] : []),
    ];
    await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(state.queries.some((q) => q.sql.startsWith("insert into"))).toBe(false);
    expect(state.queries.find((q) => q.sql.includes('from "entitlements"'))?.sql).toContain(
      "clock_timestamp()",
    );
    expect(state.queries.at(-1)?.sql).toContain("clock_timestamp()");
  }
});
it("guards an existing upsert and retains monotonic progress and update time", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [["prd_a", false, 2, "2026-10-12T00:01:00Z", "8"]],
    [[1]],
    [["5"]],
    [["prd_a", true, 3, "2026-10-12T00:01:00.001Z"]],
    [],
  ];
  await repo.command({
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 2 },
    auditId: "aud_a",
  });
  const update = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(update?.sql).toContain("greatest");
  expect(update?.sql).toContain("interval '1 millisecond'");
  expect(update?.sql).toContain('where ("resource_release_watches"."revision" =');
  expect(update?.params).toContain(8n);
});
it("never audits an unexpected insertion conflict", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[1]],
    [["5"]],
    [],
  ];
  await expect(
    repo.command({
      userId: "usr_a",
      productId: "prd_a",
      command: { enabled: true, expectedRevision: 0 },
      auditId: "aud_a",
    }),
  ).rejects.toMatchObject({ code: "RELEASE_WATCH_CONFLICT" });
  const update = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(update?.sql).toContain("where false");
  expect(state.queries.some((q) => q.sql.startsWith('insert into "audit_events"'))).toBe(false);
});

it("reports the account-wide active count independently of searched watch totals", async () => {
  state.rows = [[[1, 0, 1, 0, 98]], []];
  const result = await repo.page("usr_a", 1, "disabled", "Core");
  expect(result).toMatchObject({
    activeWatchCount: 98,
    counts: { all: 1, enabled: 0, disabled: 1 },
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].sql).toContain("active.user_id=");
  expect(state.queries[0].sql).toContain("active.enabled=true");
});
