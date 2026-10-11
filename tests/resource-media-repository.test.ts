import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
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

import { resourceMediaRepository as repo } from "../packages/db/src/repositories/resource-media";

const stamp = "2026-10-11T00:00:00.000Z";
const parent = ["prd_a", "Private product", "draft", 0, "usr_a", null, stamp];
const owner = [["usr_a", "developer"]];
const command = {
  action: "save" as const,
  expectedUpdatedAt: stamp,
  items: [
    { id: "rmi_b", caption: "B" },
    { id: "rmi_a", caption: "A" },
  ],
};
const input = { productId: "prd_a", actorId: "usr_a", auditId: "aud_a", command };
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
it("holds parent and live rights before reordering every product-scoped image and committing audit", async () => {
  state.rows = [
    [parent],
    owner,
    [
      ["rmi_a", "A", 0],
      ["rmi_b", "B", 1],
    ],
    [],
    [],
    [],
    [["prd_a", "Private product", "draft", stamp]],
    [
      ["rmi_b", "B", 0, 30, 20],
      ["rmi_a", "A", 1, 40, 20],
    ],
  ];
  const result = await repo.command(input);
  expect(result.items[0]).toMatchObject({ id: "rmi_b", url: "/api/resource-media/rmi_b" });
  expect(state.queries[0]?.sql).toContain("for no key update");
  expect(state.queries[1]?.sql).toContain("for share");
  const updates = state.queries.filter((v) => v.sql.startsWith('update "resource_media"'));
  expect(updates).toHaveLength(2);
  for (const update of updates) {
    expect(update.sql).toContain('"resource_media"."product_id" =');
    expect(update.params).toContain("prd_a");
  }
  expect(state.queries.some((v) => v.params.includes("product.media.save"))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/storageKey|scanner|sha256Hash/u);
});
it("refuses stale metadata revisions before locking or changing image rows", async () => {
  state.rows = [[parent], owner];
  await expect(
    repo.command({ ...input, command: { ...command, expectedUpdatedAt: "2026-10-10T00:00:00Z" } }),
  ).rejects.toMatchObject({ code: "RESOURCE_MEDIA_CONFLICT" });
  expect(state.queries).toHaveLength(2);
});
it("rejects foreign or omitted gallery members before any updates", async () => {
  state.rows = [[parent], owner, [["rmi_a", "A", 0]]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "RESOURCE_MEDIA_CONFLICT" });
  expect(state.queries).toHaveLength(3);
});
it("checks current organization permissions instead of original authorship", async () => {
  state.rows = [
    [
      parent
        .slice(0, 6)
        .map((v, i) => (i === 5 ? "org_a" : v))
        .concat(stamp),
    ],
    [["usr_other"]],
    owner,
    [],
  ];
  await expect(repo.managed("prd_a", "usr_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((v) => v.sql.includes('"organization_members"'))).toBe(true);
});
it("keeps withdrawn galleries read-only", async () => {
  state.rows = [[parent.map((v, i) => (i === 2 ? "archived" : v))], owner];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
  expect(state.queries).toHaveLength(2);
});
it("public galleries require published free parents and genuinely scanned versions", async () => {
  state.rows = [[["rmi_a", "Public caption", 0, 30, 20]]];
  expect(await repo.publicItems("prd_a")).toEqual([
    {
      id: "rmi_a",
      caption: "Public caption",
      position: 0,
      width: 30,
      height: 20,
      url: "/api/resource-media/rmi_a",
    },
  ]);
  const query = state.queries[0];
  expect(query?.params).toContain("published");
  expect(query?.params).toContain("clean");
  expect(query?.sql).toContain('"builds"."scanned_at" is not null');
  expect(query?.sql).not.toContain('"resource_media"."storage_key"');
});
it("refuses unpublished image bytes to an anonymous viewer before storage authority is returned", async () => {
  state.rows = [
    [["rmi_a", "Private", 0, 20, 10, "prd_a", "assets/secret.png", "a".repeat(64), 100]],
    [],
  ];
  await expect(repo.authorizeImage("rmi_a")).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
});
it("does not invalidate review or write audit when order and captions are unchanged", async () => {
  state.rows = [
    [parent],
    owner,
    [["rmi_a", "A", 0]],
    [["prd_a", "Private product", "draft", stamp]],
    [["rmi_a", "A", 0, 20, 10]],
  ];
  await repo.command({ ...input, command: { ...command, items: [{ id: "rmi_a", caption: "A" }] } });
  expect(state.queries.some((v) => /^(update|insert|delete)/u.test(v.sql))).toBe(false);
});
