import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    h.queries.push({ sql, params });
    return { rows: h.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            h.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { readResourceReleaseWatchHistory as history } from "../packages/db/src/repositories/resource-release-watch-history";
const date = "2026-10-12T00:00:00.000Z",
  query = { page: 1, days: 30 as const, source: "all" as const };
const event = (extra = {}) => ({
  id: "aud_a",
  createdAt: date,
  action: "library.release_watch_changed",
  targetId: "prd_a",
  payload: { enabled: true, revision: 2, private: "SECRET-PAYLOAD" },
  private: "SECRET-AUDIT",
  ...extra,
});
beforeEach(() => {
  h.rows = [];
  h.queries = [];
  h.options = [];
});
it("reads only session actor commands in one database-time snapshot and batches current metadata lookup", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [event()],
    [
      {
        productId: "prd_a",
        available: true,
        title: "Current",
        enabled: false,
        revision: 3,
        lastSequence: "SECRET-CURSOR",
      },
    ],
  ];
  const result = await history("usr_a", query);
  expect(result).toMatchObject({
    generatedAt: date,
    items: [
      {
        source: "individual",
        changes: [
          {
            productId: "prd_a",
            enabled: true,
            revision: 2,
            currentTitle: "Current",
            currentWatch: { enabled: false, revision: 3 },
          },
        ],
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(h.queries).toHaveLength(5);
  expect(h.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const text = h.queries.map((row) => row.sql).join("\n");
  expect(text).toContain("transaction_timestamp()");
  expect(text).toContain(`"audit_events"."actor_type"='user'`);
  expect(text).toContain(" IN ('library.release_watch_changed'");
  expect(text).not.toMatch(
    /ip_address|user_agent|last_sequence|storage_key|for share|insert into|update /u,
  );
});
it("retains recorded IDs but masks names after grant loss and avoids per-resource queries", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [
      event({
        action: "library.release_watches_disabled",
        targetId: "usr_a",
        payload: {
          changedCount: 2,
          items: [
            { productId: "prd_a", revision: 2 },
            { productId: "prd_b", revision: 3 },
          ],
        },
      }),
    ],
    [
      { productId: "prd_a", available: false, title: "PRIVATE-TITLE", enabled: false, revision: 2 },
      {
        productId: "prd_b",
        available: false,
        title: "PRIVATE-TITLE",
        enabled: null,
        revision: null,
      },
    ],
  ];
  const result = await history("usr_a", { ...query, productId: "prd_a", source: "batch" });
  expect(result.items[0].changes).toHaveLength(2);
  expect(result.items[0].changes?.every((row) => row.currentTitle === null)).toBe(true);
  expect(JSON.stringify(result)).not.toContain("PRIVATE-TITLE");
  expect(h.queries).toHaveLength(5);
  expect(h.queries[2].sql).toContain("jsonb_array_elements");
  expect(h.queries[2].params).toContain("prd_a");
  expect(h.queries[2].params).toContain("library.release_watches_disabled");
});
it("keeps malformed or over-limit payloads neutral and skips metadata reads", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [event({ payload: { enabled: "true", revision: 2 } })],
  ];
  const result = await history("usr_a", query);
  expect(result.items[0]).toMatchObject({ source: "unknown", changes: null, collection: null });
  expect(h.queries).toHaveLength(4);
  const projection = h.queries.at(-1)?.sql ?? "";
  expect(projection).toContain("BETWEEN 1 AND 20");
  expect(projection).toContain("left(entry->>'productId',161)");
  expect(projection).toContain("jsonb_typeof");
});
it("requires a live account and rejects direct invalid scopes before querying", async () => {
  h.rows = [[]];
  await expect(history("usr_a", query)).rejects.toMatchObject({ statusCode: 404 });
  h.queries = [];
  await expect(history("usr_a", { ...query, page: 1001 })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(h.queries).toHaveLength(0);
});

it("includes resume operations in the own-user batch filter without widening target authority", async () => {
  h.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [
      event({
        action: "library.release_watches_resumed",
        targetId: "usr_a",
        payload: { changedCount: 1, items: [{ productId: "prd_a", revision: 3 }] },
      }),
    ],
    [],
  ];
  const result = await history("usr_a", { ...query, source: "batch" });
  expect(result.items[0]).toMatchObject({
    source: "batch",
    changes: [{ productId: "prd_a", enabled: true }],
  });
  expect(h.queries[2].params).toContain("library.release_watches_resumed");
  expect(h.queries[2].sql).toContain(`"audit_events"."target_type"`);
  expect(h.queries[2].sql).toContain(`"audit_events"."target_id"=`);
});
