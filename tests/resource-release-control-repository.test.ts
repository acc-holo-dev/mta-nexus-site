import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { ResourceLibrarySelectionsRepository } from "../packages/db/src/repositories/resource-library-selections";
import { ResourceModerationRepository } from "../packages/db/src/repositories/resource-moderation";
import { ProductRepository } from "../packages/db/src/repositories/products";
import { UserLibraryRepository } from "../packages/db/src/repositories/user-library";
const library = new ResourceLibrarySelectionsRepository(),
  moderation = new ResourceModerationRepository();
const now = new Date("2026-10-10T12:00:00.000Z"),
  stamp = now.toISOString();
const product = (status = "published", updated = stamp) => [
  "prd_a",
  "PRIVATE TITLE",
  "private-slug",
  status,
  "1.0.0",
  updated,
];
const fixed = { mode: "fixed" as const, expectedRevision: 0, buildId: "bld_a" };
const input = { userId: "usr_a", productId: "prd_a", command: fixed, auditId: "aud_a" };
const command = {
  action: "release" as const,
  expectedUpdatedAt: stamp,
  reason: "Reviewed clean evidence",
};
const modInput = { actorId: "usr_mod", productId: "prd_a", command, auditId: "aud_a" };
const clockRows = [{ observedAt: stamp }];
const ownedRows = (status = "published", expiry: string | null = null) => [
  [],
  [["prd_a", "PRIVATE TITLE", "private-slug", status]],
  [["usr_a"]],
  [["ent_a", expiry]],
];
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());
it("locks live buyer rights and a cleared build before saving a preference with audit", async () => {
  state.results = [...ownedRows(), [], [["bld_a"]], clockRows, [[1, "fixed", "bld_a", stamp]], []];
  expect(await library.command(input)).toMatchObject({
    productId: "prd_a",
    selection: { revision: 1, mode: "fixed", buildId: "bld_a" },
  });
  const sql = state.queries.map((q) => q.sql).join("\n");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain('"entitlements"."subject_id" =');
  expect(sql).toContain("for share");
  const buildQuery = state.queries.find((q) => q.sql.includes('from "builds"'));
  expect(buildQuery?.params).toEqual(
    expect.arrayContaining(["prd_a", "bld_a", "published", "clean"]),
  );
  expect(buildQuery?.sql).toContain('"builds"."scanner" is not null');
  expect(buildQuery?.sql).toContain('"builds"."scanned_at" is not null');
  expect(sql).toContain('insert into "resource_library_selections"');
  expect(sql).toContain('insert into "audit_events"');
  expect(state.queries.at(-1)?.params).toContain("library.release_selected");
  expect(sql).not.toMatch(
    /(?:insert into|update) "(?:entitlements|licenses|payments|orders|ledger_entries)"/u,
  );
});
it("does not turn publisher or administrator access into a buyer library right", async () => {
  state.results = [[], [["prd_a", "Title", "slug", "published"]], [["usr_a"]], [], []];
  await expect(library.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.map((q) => q.sql).join("\n")).not.toContain("insert into");
  expect(state.queries.some((q) => q.sql.includes('"licenses"."status"'))).toBe(true);
});
it.each(["suspended", "archived", "draft"])(
  "cannot pin a version on a %s resource",
  async (status) => {
    state.results = [...ownedRows(status), []];
    await expect(library.command(input)).rejects.toMatchObject({
      code: "LIBRARY_RELEASE_UNAVAILABLE",
    });
    expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  },
);
it("rejects withdrawn or foreign fixed builds without substituting the latest", async () => {
  state.results = [...ownedRows(), [], []];
  await expect(library.command(input)).rejects.toMatchObject({
    code: "LIBRARY_RELEASE_UNAVAILABLE",
  });
  expect(state.queries.at(-1)?.params).toContain("bld_a");
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("a stale preference cannot overwrite another device's selection", async () => {
  state.results = [...ownedRows(), [[2, "fixed", "bld_other", stamp]], [["bld_a"]]];
  await expect(library.command(input)).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("an exact command replay keeps its revision and creates no duplicate audit", async () => {
  state.results = [...ownedRows(), [[1, "fixed", "bld_a", stamp]], [["bld_a"]], clockRows];
  expect(await library.command(input)).toMatchObject({ selection: { revision: 1 } });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("can clear a withdrawn preference while a resource is suspended, without granting files", async () => {
  state.results = [
    ...ownedRows("suspended"),
    [[3, "fixed", "withdrawn", stamp]],
    clockRows,
    [[4, "latest", null, "2026-10-10T12:00:00.001Z"]],
    [],
  ];
  expect(
    await library.command({ ...input, command: { mode: "latest", expectedRevision: 3 } }),
  ).toMatchObject({ selection: { mode: "latest", buildId: null, revision: 4 } });
  expect(state.queries.some((q) => q.sql.includes('from "builds"'))).toBe(false);
});
it("rechecks expiry after waiting on a build lock", async () => {
  state.results = [...ownedRows("published", "2026-10-10T12:00:00.001Z"), [], [["bld_a"]]];
  state.results.push([{ observedAt: "2026-10-10T12:00:00.002Z" }]);
  // Application time remains behind the database clock after a blocking lock.
  await expect(library.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("masks private metadata and filters updates in SQL before bounded pagination", async () => {
  state.results = [[{ all: 24, updates: 21, pinned: 21, unavailable: 3 }], []];
  const result = await library.page("usr_a' --", 2, "updates");
  expect(result).toMatchObject({ total: 21, page: 2, pageSize: 20 });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const query = state.queries.at(-1);
  expect(query?.sql).toContain("THEN product.title END");
  expect(query?.sql).toContain('"licenses"."status" = \'active\'');
  expect(query?.sql).toContain('"entitlements"."expires_at" >');
  expect(query?.sql).toContain("WHERE state = 'update_available' ORDER BY");
  expect(query?.params.slice(-2)).toEqual([20, 20]);
  expect(query?.params).toContain("usr_a' --");
  expect(query?.sql).not.toContain("usr_a' --");
  expect(query?.sql).not.toContain('"licenses"."key"');
  expect(query?.sql).not.toContain('"builds"."storage_key"');
});
it("does not reveal titles or releases in a suspended buyer detail", async () => {
  state.results = [
    [["prd_a", "PRIVATE TITLE", "private-slug", "suspended"]],
    [["usr_a"]],
    [["ent_a", null]],
    [[2, "fixed", "bld_a", stamp]],
  ];
  expect(await library.detail("usr_a", "prd_a")).toMatchObject({
    product: { title: null, slug: null },
    selected: null,
    latest: null,
    versions: [],
  });
  expect(state.queries.some((q) => q.sql.includes('from "builds"'))).toBe(false);
});
it("projects reviewed archive identities for safe buyer choices without private file locations", async () => {
  const release = ["bld_a", "1.0.0", "Notes", stamp, "a".repeat(64), 100];
  state.results = [...ownedRows().slice(1), [], [release], [[1]], [release]];
  const detail = await library.detail("usr_a", "prd_a");
  expect(detail.versions[0]).toMatchObject({
    id: "bld_a",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 100,
  });
  const queries = state.queries.filter((q) => q.sql.includes('from "builds"'));
  expect(queries).toHaveLength(3);
  expect(queries[0]?.sql).toContain('"sha256_hash"');
  expect(queries[0]?.sql).toContain('"file_size_bytes"');
  expect(queries.every((q) => !q.sql.includes('"storage_key"'))).toBe(true);
});
it("releasing a restriction drafts published/pending versions and preserves quarantine", async () => {
  state.results = [
    [product("suspended")],
    [["moderator"]],
    [["bld_a"], ["bld_b"]],
    [],
    [product("draft", "2026-10-10T12:00:00.001Z")],
    [],
  ];
  expect(await moderation.command(modInput)).toMatchObject({ product: { status: "draft" } });
  const buildUpdate = state.queries.find((q) => q.sql.startsWith('update "builds"'));
  expect(buildUpdate?.params).toEqual(["draft", "prd_a", "published", "pending_review"]);
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries.at(-1)?.params).toContain("product.moderation_released");
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /(?:delete from|update) "(?:licenses|entitlements|payments|orders)"/u,
  );
});
it.each(["developer", "user"])(
  "a revoked staff role (%s) cannot release a resource",
  async (role) => {
    state.results = [[product("suspended")], [[role]]];
    await expect(moderation.command(modInput)).rejects.toMatchObject({ statusCode: 403 });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects stale moderation before changing any builds or writing an audit", async () => {
  state.results = [[product("suspended", "2026-10-10T12:00:00.001Z")], [["admin"]]];
  await expect(moderation.command(modInput)).rejects.toMatchObject({
    code: "PRODUCT_METADATA_CONFLICT",
  });
  expect(state.queries).toHaveLength(2);
});
it("suspension changes availability without destroying releases or acquired rights", async () => {
  state.results = [
    [product()],
    [["admin"]],
    [product("suspended", "2026-10-10T12:00:00.001Z")],
    [],
  ];
  expect(
    await moderation.command({ ...modInput, command: { ...command, action: "suspend" } }),
  ).toMatchObject({ product: { status: "suspended" } });
  expect(state.queries.some((q) => q.sql.startsWith('update "builds"'))).toBe(false);
});
it("hides historical internal staff notes from the publisher", async () => {
  state.results = [
    [["prd_a", "usr_a", null]],
    [["usr_a", "developer"]],
    [[1]],
    [["aud_a", "admin.restore", "", stamp]],
  ];
  const result = await moderation.publisherHistory("usr_a", "prd_a");
  expect(result.events[0].reason).toBe("");
  expect(state.queries.at(-1)?.sql).toContain("else '' end");
  expect(state.queries.at(-1)?.sql).not.toContain("->>'notes'");
});
it("uses actual current admin authority for private resource reads", async () => {
  state.results = [];
  expect(
    await new ProductRepository().hasManagementAccess("prd_a", {
      id: "usr_stale_admin",
      role: "admin",
    }),
  ).toBe(false);
  const query = state.queries[0];
  expect(query.sql).toContain('"users"');
  expect(query.sql).toContain("role");
  expect(query.params).toContain("usr_stale_admin");
});
it("legacy feature changes require a live staff grant and advance the moderation revision", async () => {
  const audit = {
    id: "aud_a",
    actorId: "usr_mod",
    actorType: "admin" as const,
    action: "admin.feature",
    targetType: "product",
    targetId: "prd_a",
  };
  state.results = [[["prd_a"]], [["user"]]];
  await expect(
    new ProductRepository().updateWithAudit("prd_a", { isFeatured: true }, audit),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  state.queries = [];
  state.results = [[["prd_a"]], [["moderator"]], [], []];
  await new ProductRepository().updateWithAudit("prd_a", { isFeatured: true }, audit);
  expect(state.queries.find((query) => query.sql.startsWith("update"))?.sql).toContain(
    "interval '1 millisecond'",
  );
});
it("main library reads a fixed cleared build and retains the unavailable state after withdrawal", async () => {
  state.results = [
    [{ all: 2, ready: 1, unavailable: 1 }],
    [
      {
        resourceId: "prd_a",
        title: "Title",
        slug: "slug",
        version: "1.0.0",
        downloadable: true,
        selectionMode: "fixed",
        buildId: "bld_a",
        addedAt: now,
      },
      {
        resourceId: "prd_b",
        title: null,
        slug: null,
        version: null,
        downloadable: false,
        selectionMode: "fixed",
        buildId: "withdrawn",
        addedAt: now,
      },
    ],
  ];
  const result = await new UserLibraryRepository().pageByUser("usr_a");
  expect(result.items[0]).toMatchObject({
    version: "1.0.0",
    buildId: "bld_a",
    selectionMode: "fixed",
    downloadable: true,
  });
  expect(result.items[1]).toMatchObject({
    version: null,
    buildId: null,
    selectionMode: "fixed",
    downloadable: false,
  });
  const sql = state.queries.at(-1)?.sql;
  expect(sql).toContain('"resource_library_selections"."mode"');
  expect(sql).toContain('"builds"."id" = "resource_library_selections"."build_id"');
});

it("fails closed when the database clock cannot be read", async () => {
  state.results = [...ownedRows(), [], [["bld_a"]], [{ observedAt: "invalid" }]];
  await expect(library.command(input)).rejects.toMatchObject({
    code: "LIBRARY_RELEASE_TIME_UNKNOWN",
  });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("rejects malformed repository commands before taking locks", async () => {
  await expect(
    library.command({ ...input, command: { ...fixed, expectedRevision: 1.5 } }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
it("does not overwrite an unexpected insert race or write its audit", async () => {
  state.results = [...ownedRows(), [], [["bld_a"]], clockRows, []];
  await expect(library.command(input)).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
  expect(state.queries.at(-1)?.sql).toContain("where false");
  expect(state.queries.some((q) => q.sql.includes('insert into "audit_events"'))).toBe(false);
});
it("guards an existing revision and advances a future timestamp monotonically", async () => {
  state.results = [
    ...ownedRows(),
    [[3, "latest", null, "2026-10-11T12:00:00.000Z"]],
    [["bld_a"]],
    clockRows,
    [[4, "fixed", "bld_a", "2026-10-11T12:00:00.001Z"]],
    [],
  ];
  await library.command({ ...input, command: { ...fixed, expectedRevision: 3 } });
  const query = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_library_selections"'),
  );
  expect(query?.sql).toContain('where "resource_library_selections"."revision" =');
  expect(query?.params).toContain("2026-10-11T12:00:00.001Z");
  expect(query?.params.at(-1)).toBe(3);
});

it.each([
  { sha256Hash: "b".repeat(64), fileSizeBytes: 100 },
  { sha256Hash: "a".repeat(64), fileSizeBytes: 101 },
])("rejects a reviewed archive identity that changed %j", async (reviewedArtifact) => {
  state.results = [...ownedRows(), [], [["bld_a", "a".repeat(64), 100]]];
  await expect(
    library.command({ ...input, command: { ...fixed, reviewedArtifact } }),
  ).rejects.toMatchObject({ code: "LIBRARY_RELEASE_REVIEW_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  expect(state.queries.at(-1)?.sql).toContain("for share");
});
it("saves and replays an exact reviewed archive without duplicating audit", async () => {
  const reviewedArtifact = { sha256Hash: "a".repeat(64), fileSizeBytes: 100 };
  state.results = [
    ...ownedRows(),
    [],
    [["bld_a", reviewedArtifact.sha256Hash, 100]],
    clockRows,
    [[1, "fixed", "bld_a", stamp]],
    [],
  ];
  const first = await library.command({ ...input, command: { ...fixed, reviewedArtifact } });
  expect(first.selection).toMatchObject({ mode: "fixed", buildId: "bld_a", revision: 1 });
  state.queries = [];
  state.results = [
    ...ownedRows(),
    [[1, "fixed", "bld_a", stamp]],
    [["bld_a", reviewedArtifact.sha256Hash, 100]],
    clockRows,
  ];
  expect(await library.command({ ...input, command: { ...fixed, reviewedArtifact } })).toEqual(
    first,
  );
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
