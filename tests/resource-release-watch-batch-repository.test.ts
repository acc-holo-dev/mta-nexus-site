import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  sessionLive: true,
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"'))
      return { rows: state.sessionLive ? [["ses_a", "2099-01-01T00:00:00.000Z"]] : [] };
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
import { disableResourceReleaseWatchBatch as disable } from "../packages/db/src/repositories/resource-release-watch-batches";
const stamp = "2026-10-12T00:00:00.000Z";
const input = {
  userId: "usr_a",
  currentToken: "tok_a",
  auditId: "aud_a",
  command: {
    items: [
      { productId: "prd_a", expectedRevision: 1 },
      { productId: "prd_b", expectedRevision: 3 },
    ],
  },
};
const before = (a = true, b = true, ar = 1, br = 3) => [
  [],
  [],
  [],
  [["usr_a"]],
  [
    ["prd_b", b, br, stamp],
    ["prd_a", a, ar, stamp],
  ],
];
const output = [
  { productId: "prd_b", enabled: false, revision: 4, updatedAt: stamp, lastSequence: "SECRET" },
  { productId: "prd_a", enabled: false, revision: 2, updatedAt: stamp },
];
function successful() {
  state.rows = [...before(), [{ observedAt: stamp }], output, []];
}
beforeEach(() => {
  state.sessionLive = true;
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
it("locks only the actor's watches and atomically updates one bounded batch with mandatory audit", async () => {
  successful();
  const result = await disable(input);
  expect(result.changedCount).toBe(2);
  expect(result.items.map((row) => row.productId)).toEqual(["prd_a", "prd_b"]);
  expect(JSON.stringify(result)).not.toContain("SECRET");
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("pg_advisory_xact_lock");
  expect(text).toContain('"resource_release_watches"."user_id" =');
  expect(text).toContain("for no key update");
  expect(text).toContain("clock_timestamp()");
  expect(text).toContain("watch.revision=r.");
  expect(text).toContain("watch.enabled=true");
  expect(text).not.toMatch(/entitlements|licenses|notifications|last_sequence/u);
  expect(state.queries.at(-1)?.params).toContain("library.release_watches_disabled");
});
it("acknowledges the complete successor state without another update or audit", async () => {
  state.rows = before(false, false, 2, 4);
  expect(await disable(input)).toMatchObject({ changedCount: 0 });
  expect(state.queries.some((q) => q.sql.includes("UPDATE") || q.sql.startsWith("insert"))).toBe(
    false,
  );
});
it.each([
  [false, true, 2, 3],
  [true, true, 9, 3],
  [false, false, 2, 8],
])("rejects mixed replay or stale state %j", async (a, b, ar, br) => {
  state.rows = before(Boolean(a), Boolean(b), Number(ar), Number(br));
  await expect(disable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.includes("UPDATE"))).toBe(false);
});
it("rejects missing or foreign watches before any mutation", async () => {
  state.rows = [[], [], [], [["usr_a"]], [["prd_a", true, 1, stamp]]];
  await expect(disable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.includes("UPDATE"))).toBe(false);
});
it("fails the transaction before audit if a guarded update returns an incomplete batch", async () => {
  state.rows = [...before(), [{ observedAt: stamp }], [output[0]]];
  await expect(disable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("propagates a mandatory audit failure to the transaction", async () => {
  successful();
  state.failAudit = true;
  await expect(disable(input)).rejects.toMatchObject({ cause: { message: "audit failed" } });
});
it("requires a live account and valid database time", async () => {
  state.rows = [[], [], [], []];
  await expect(disable(input)).rejects.toMatchObject({ statusCode: 404 });
  state.rows = [...before(), [{ observedAt: "invalid" }]];
  await expect(disable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.includes("UPDATE"))).toBe(false);
});
it("validates direct commands before database access", async () => {
  await expect(
    disable({ ...input, command: { items: [{ productId: "prd_a", expectedRevision: 0 }] } }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});

it("checks the initiating session after watch locks before acknowledging a stop replay", async () => {
  state.sessionLive = false;
  state.rows = before(false, false, 2, 4);
  await expect(disable(input)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.queries.at(-2)?.sql).toContain("for no key update");
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
  expect(state.queries.some((q) => q.sql.includes("UPDATE") || q.sql.startsWith("insert"))).toBe(
    false,
  );
});
