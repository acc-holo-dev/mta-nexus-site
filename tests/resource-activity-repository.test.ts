import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Build } from "@nexus/domain";

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
import { ResourceActivityRepository } from "../packages/db/src/repositories/resource-activity";
import { ResourceDownloadAuthorizationRepository } from "../packages/db/src/repositories/resource-download-authorization";
import { OrderRepository } from "../packages/db/src/repositories/orders";
import { claimFreeResourceInTransaction } from "../packages/db/src/repositories/entitlements";
import { db } from "../packages/db/src/client";
import { builds, entitlements } from "../packages/db/src/schema";

const activity = new ResourceActivityRepository(),
  downloads = new ResourceDownloadAuthorizationRepository();
const now = new Date("2026-10-10T12:00:00Z");
const expected = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "published",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: now,
  storageKey: "private.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 10,
  fileName: "resource.zip",
  mimeType: "application/zip",
} as Build;
function buildRow(changes = {}) {
  const value: Record<string, unknown> = { ...expected, ...changes };
  return Object.keys(getTableColumns(builds)).map((key) => value[key] ?? null);
}
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it("scopes acquisition history before pagination and masks unavailable metadata", async () => {
  state.results = [
    [[21]],
    [["ent_a", "prd_a", "direct", now.toISOString(), null, null, false, false]],
  ];
  const result = await activity.buyerHistory("usr_buyer' --", 2, "direct");
  expect(result).toMatchObject({
    total: 21,
    page: 2,
    pageSize: 20,
    filter: "direct",
    items: [{ title: null, slug: null, hasCurrentAccess: false }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[0].params).toContain("usr_buyer' --");
  const query = state.queries[1];
  expect(query.sql).toContain('left join "products"');
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("else null end");
  expect(query.sql).toContain('"licenses"."status" = \'active\'');
  expect(query.sql).toContain('"entitlements"."expires_at" >');
  expect(query.sql).toContain('"builds"."scanner" is not null');
  expect(query.sql).not.toContain("usr_buyer' --");
  expect(query.sql).not.toContain('"licenses"."key"');
  expect(query.sql).not.toContain('"request_id"');
  expect(query.params.slice(-2)).toEqual([20, 20]);
});

it("holds live personal publisher authority and returns bounded UTC aggregates", async () => {
  state.results = [
    [["prd_a", "Title", "archived", "usr_author", null]],
    [["usr_author", "developer"]],
    [{ acquisitions: 3, direct: 1, cart: 2, retainedGrants: 2, downloadStarts: 4 }],
    [{ day: "2026-10-10", acquisitions: 1, downloadStarts: 2 }],
  ];
  expect(await activity.publisherReport("usr_author", "prd_a", 7)).toMatchObject({
    days: 7,
    from: new Date("2026-10-04T00:00:00Z"),
    through: now,
    acquisitions: 3,
    direct: 1,
    cart: 2,
    retainedGrants: 2,
    downloadStarts: 4,
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("product.download_started");
  expect(state.queries[2].sql).not.toContain('"actor_id"');
  expect(state.queries[3].sql).toContain("generate_series");
  expect(state.queries[3].sql).toContain("at time zone 'UTC'");
  expect(state.queries[3].params.at(-1)).toBe(7);
});

it("does not return organization activity to a historical author with no current grant", async () => {
  state.results = [
    [["prd_a", "Private", "published", "usr_author", "org_a"]],
    [["usr_owner"]],
    [["usr_author", "developer"]],
    [],
  ];
  await expect(activity.publisherReport("usr_author", "prd_a", 30)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(4);
  expect(state.queries.some((q) => q.sql.includes("generate_series"))).toBe(false);
});

it("allows a current organization product manager and checks live membership", async () => {
  state.results = [
    [["prd_a", "Private", "published", "usr_author", "org_a"]],
    [["usr_owner"]],
    [["usr_manager", "user"]],
    [["member", ["manage_products"]]],
    [],
    [],
  ];
  expect(await activity.publisherReport("usr_manager", "prd_a")).toMatchObject({ acquisitions: 0 });
  expect(state.queries[3].params).toEqual(["org_a", "usr_manager", 1]);
  expect(state.queries[3].sql).toContain("for share");
});

it("excludes organization products and filters completed sales before limiting", async () => {
  await new OrderRepository().pageSellerHistory("usr_former_author");
  for (const q of state.queries) expect(q.sql).toContain('"products"."organization_id" is null');
  state.queries = [];
  await new OrderRepository().listSalesBySeller("usr_former_author", 999999);
  expect(state.queries[0].sql).toContain('"products"."organization_id" is null');
  expect(state.queries[0].params).toContain("completed");
  expect(state.queries[0].params.at(-1)).toBe(100);
});

it("records cart acquisition provenance in the same grant transaction", async () => {
  const value: Record<string, unknown> = {
    id: "ent_a",
    subjectType: "user",
    subjectId: "usr_buyer",
    permission: "product.download",
    resourceId: "prd_a",
    createdAt: now.toISOString(),
  };
  const grant = Object.keys(getTableColumns(entitlements)).map((key) => value[key] ?? null);
  state.results = [[], [["published", 0]], [["bld_a"]], [], [], [grant], [], []];
  await db.transaction((tx) =>
    claimFreeResourceInTransaction(tx, {
      userId: "usr_buyer",
      productId: "prd_a",
      entitlementId: "ent_a",
      source: "cart",
      requestId: "request-a",
    }),
  );
  const event = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_acquisition_events"'),
  );
  expect(event?.params).toContain("cart");
  expect(event?.params).toContain("request-a");
  expect(state.queries.filter((q) => q.sql.startsWith('insert into "entitlements"'))).toHaveLength(
    1,
  );
  expect(state.queries.at(-1)?.sql).toContain('"sales_count"');
});

it("denies a revoked license at the final gate without emitting a start audit", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [],
    [],
  ];
  await expect(
    downloads.authorize({ actorId: "usr_buyer", auditId: "aud_a", receiptId: "dlv_a", expected, pinned: false }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  expect(state.queries.at(-1)?.params).toContain("active");
  expect(state.queries.at(-1)?.sql).toContain("for share");
});

it("audits a licensed transfer only after locking current access and unchanged artifact evidence", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [],
    [["lic_a", "2026-10-11T00:00:00Z"]],
    [buildRow()],
    [],
  ];
  expect(
    await downloads.authorize({ actorId: "usr_buyer", auditId: "aud_a", receiptId: "dlv_a", expected, pinned: true }),
  ).toEqual({ slug: "resource", receiptId: "dlv_a" });
  const audit = state.queries.at(-1);
  expect(audit?.params).toContain("product.download_started");
  expect(audit?.params).toContain(
    JSON.stringify({ buildId: "bld_a", version: "1.0.0", pinned: true, accessSource: "license", receiptId: "dlv_a" }),
  );
  expect(state.queries[4].sql).not.toContain('"key"');
  expect(state.queries[5].sql).toContain("for share");
});

it.each([
  { status: "quarantined" },
  { scanner: "different" },
  { scannedAt: new Date(now.getTime() + 1) },
  { storageKey: "replaced.zip" },
  { sha256Hash: "b".repeat(64) },
  { version: "2.0.0" },
])("rejects changed storage evidence at the final gate: %j", async (change) => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_author", "developer"]],
    [buildRow(change)],
  ];
  await expect(
    downloads.authorize({ actorId: "usr_author", auditId: "aud_a", receiptId: "dlv_a", expected, pinned: false }),
  ).rejects.toMatchObject({ code: "BUILD_STATE_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("rechecks expiry after waiting for artifact locks", async () => {
  state.results = [
    [["prd_a", "resource", "published", "usr_author", null]],
    [["usr_buyer", "user"]],
    [["user"]],
    [["ent_a", "2026-10-10T11:59:59Z"]],
    [buildRow()],
  ];
  await expect(
    downloads.authorize({ actorId: "usr_buyer", auditId: "aud_a", receiptId: "dlv_a", expected, pinned: false }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("rejects a resource archived during storage preparation", async () => {
  state.results = [[["prd_a", "resource", "archived", "usr_author", null]]];
  await expect(
    downloads.authorize({ actorId: "usr_author", auditId: "aud_a", receiptId: "dlv_a", expected, pinned: false }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
