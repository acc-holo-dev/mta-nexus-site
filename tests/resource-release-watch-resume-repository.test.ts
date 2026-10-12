import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failed");
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
import { resumeResourceReleaseWatches as resume } from "../packages/db/src/repositories/collection-release-watches";
const stamp = "2026-10-12T00:00:00.000Z";
const input = {
  userId: "usr_a",
  auditId: "aud_a",
  command: {
    items: [
      { productId: "prd_b", expectedRevision: 3 },
      { productId: "prd_a", expectedRevision: 1 },
    ],
  },
};
const ready = (
  previous: unknown[][] = [
    ["prd_a", false, 1, stamp],
    ["prd_b", false, 3, stamp],
  ],
) => [
  [],
  [],
  [],
  [["usr_a"]],
  [
    ["prd_a", "published"],
    ["prd_b", "published"],
  ],
  [["ent_a", null]],
  [["bld_a"]],
  [["ent_b", null]],
  [["bld_b"]],
  previous,
];
const output = [
  { productId: "prd_b", enabled: true, revision: 4, updatedAt: stamp },
  { productId: "prd_a", enabled: true, revision: 2, updatedAt: stamp },
];
const success = () => {
  state.rows = [...ready(), [[4]], [{ observedAt: stamp }], output, []];
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
it("resumes only the reviewed existing stopped watches through the shared baseline enrollment transaction", async () => {
  success();
  const result = await resume(input);
  expect(result).toMatchObject({
    changedCount: 2,
    items: [
      { productId: "prd_a", enabled: true, revision: 2 },
      { productId: "prd_b", enabled: true, revision: 4 },
    ],
  });
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("pg_advisory_xact_lock");
  expect(text).toContain("for no key update");
  expect(text).toContain("clock_timestamp()");
  expect(text).toContain("max(");
  expect(text).toContain("greatest(");
  expect(text).toContain("excluded.revision-1");
  expect(text).not.toContain("library_collection");
  expect(state.queries.at(-1)?.params).toContain("library.release_watches_resumed");
  expect(state.queries.at(-1)?.params).toContain("usr_a");
  expect(JSON.stringify(result)).not.toContain("lastSequence");
});
it("does not enroll an absent or foreign watch", async () => {
  state.rows = ready([["prd_a", false, 1, stamp]]);
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.includes("INSERT INTO"))).toBe(false);
});
it("confirms only a complete successor state without a second write or audit", async () => {
  state.rows = [
    ...ready([
      ["prd_a", true, 2, stamp],
      ["prd_b", true, 4, stamp],
    ]),
    [{ observedAt: stamp }],
  ];
  expect(await resume(input)).toMatchObject({ changedCount: 0 });
  expect(
    state.queries.some((q) => q.sql.includes("INSERT INTO") || q.sql.startsWith("insert")),
  ).toBe(false);
});
it.each([
  {
    previous: [
      ["prd_a", true, 2, stamp],
      ["prd_b", false, 3, stamp],
    ],
  },
  {
    previous: [
      ["prd_a", false, 9, stamp],
      ["prd_b", false, 3, stamp],
    ],
  },
])("rejects mixed retry states or stale revisions as one batch", async ({ previous }) => {
  state.rows = ready(previous);
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
it("rechecks finite access after all locks and enforces the account quota", async () => {
  const rows = ready();
  rows[5] = [["ent_a", stamp]];
  state.rows = [...rows, [[4]], [{ observedAt: stamp }]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
  state.rows = [...ready(), [[99]]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_LIMIT" });
});
it("rejects withdrawn or unsafe publication before resuming any selected watch", async () => {
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [
      ["prd_a", "draft"],
      ["prd_b", "published"],
    ],
  ];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
  state.rows = ready();
  state.rows[6] = [];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
});
it("propagates required audit failure and refuses partial upsert results", async () => {
  success();
  state.failAudit = true;
  await expect(resume(input)).rejects.toMatchObject({ cause: { message: "audit failed" } });
  state.failAudit = false;
  state.rows = [...ready(), [[4]], [{ observedAt: stamp }], [output[0]]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
it("rejects unreviewed new enrollment and injected collection authority before database work", async () => {
  for (const command of [
    { items: [{ productId: "prd_a", expectedRevision: 0 }] },
    { ...input.command, expectedCollectionRevision: 1 },
  ])
    await expect(resume({ ...input, command })).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
