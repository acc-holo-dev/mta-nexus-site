import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const proxy = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: {
      transaction: async (callback: (tx: typeof proxy) => unknown, options: unknown) => {
        state.options.push(options);
        return callback(proxy);
      },
    },
  };
});

import { NotificationRepository } from "../packages/db/src/repositories/notifications";

const repo = new NotificationRepository(),
  filters = { query: "", state: "all" as const, category: "all" };
const hash = (actor = "actor", input = filters) =>
  createHash("sha256")
    .update(
      JSON.stringify([1, "notification-inbox", actor, input.query, input.state, input.category]),
    )
    .digest("hex");
const row = (id: string, time = "2026-10-11T00:00:00.123456Z") => [
  id,
  "Title",
  "Message",
  null,
  null,
  false,
  "system",
  false,
  time,
];
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("bounds two read queries in a read-only snapshot with deterministic exact ordering", async () => {
  state.rows = [Array.from({ length: 26 }, (_, n) => row(`id_${26 - n}`)), [["27"]]];
  const page = await repo.pageInbox("actor", filters);
  expect(page.items).toHaveLength(25);
  expect(page.unreadCount).toBe(27);
  expect(page.newerCursor).toBeNull();
  expect(JSON.parse(page.olderCursor ?? "")).toMatchObject({
    id: "id_2",
    createdAt: "2026-10-11T00:00:00.123456Z",
    context: hash(),
    direction: "older",
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].params).toEqual(["actor", 26]);
  expect(state.queries[0].sql).toContain(
    'order by "notifications"."created_at" desc, "notifications"."id" desc',
  );
  expect(state.queries[0].sql).toContain("SS.US");
  expect(state.queries[0].sql).not.toContain("offset");
  expect(state.queries[1].params).toEqual(["actor"]);
});
it("escapes literal search, binds category and preserves the unread partial-index predicate", async () => {
  await repo.pageInbox("recipient_'", { query: "%_\\", state: "unread", category: "content" });
  expect(state.queries[0].params).toEqual([
    "recipient_'",
    "content",
    "%\\%\\_\\\\%",
    "%\\%\\_\\\\%",
    26,
  ]);
  expect(state.queries[0].sql).toContain('"is_read" = false');
  expect(state.queries[0].sql).not.toContain("recipient_'");
  expect(state.queries[1].params).toEqual(["recipient_'"]);
});
it("selects nearest newer rows then returns display order without needing an anchor row", async () => {
  state.rows = [[row("nearest"), row("latest")], [["2"]]];
  const page = await repo.pageInbox("actor", {
    ...filters,
    cursor: {
      id: "removed",
      createdAt: "2026-10-11T00:00:00.123455Z",
      context: hash(),
      direction: "newer",
    },
  });
  expect(page.items.map((item) => item.id)).toEqual(["latest", "nearest"]);
  expect(page.newerCursor).toBeNull();
  expect(JSON.parse(page.olderCursor ?? "").id).toBe("nearest");
  expect(state.queries[0].sql).toContain(") > (");
  expect(state.queries[0].sql).toContain('"created_at" asc, "notifications"."id" asc');
  expect(state.queries[0].params).toEqual(["actor", "2026-10-11T00:00:00.123455Z", "removed", 26]);
});
it.each(["other-actor", "changed-query", "changed-state", "changed-category"])(
  "rejects a cursor after %s before SQL",
  async (change) => {
    const input = {
      ...filters,
      cursor: {
        id: "anchor",
        createdAt: "2026-10-11T00:00:00.123456Z",
        context: hash(),
        direction: "older" as const,
      },
    };
    await expect(
      repo.pageInbox(change === "other-actor" ? "foreign" : "actor", {
        ...input,
        query: change === "changed-query" ? "query" : "",
        state: change === "changed-state" ? "unread" : "all",
        category: change === "changed-category" ? "server" : "all",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it("locks all owned selections in stable order, checks observed state and updates only the recipient", async () => {
  state.rows = [
    [
      ["a", false],
      ["z", true],
    ],
    [["a"], ["z"]],
  ];
  expect(
    await repo.setInboxReadState("actor", {
      isRead: false,
      items: [
        { id: "z", expectedIsRead: true },
        { id: "a", expectedIsRead: false },
      ],
    }),
  ).toEqual({ isRead: false, ids: ["a", "z"] });
  expect(state.queries[0].params).toEqual(["actor", "a", "z"]);
  expect(state.queries[0].sql).toContain('order by "notifications"."id" asc for update');
  expect(state.queries[1].params).toEqual([false, "actor", "a", "z"]);
});
it.each([
  { owned: [["owned", false]] },
  {
    owned: [
      ["owned", true],
      ["other", false],
    ],
  },
])(
  "refuses a partially owned or concurrently changed selection without a write",
  async ({ owned }) => {
    state.rows = [owned];
    await expect(
      repo.setInboxReadState("actor", {
        isRead: true,
        items: [
          { id: "owned", expectedIsRead: false },
          { id: "other", expectedIsRead: false },
        ],
      }),
    ).rejects.toMatchObject({
      code: owned.length === 1 ? "NOT_FOUND" : "NOTIFICATION_STATE_CHANGED",
    });
    expect(state.queries).toHaveLength(1);
  },
);
it.each(
  [
    [],
    Array.from({ length: 26 }, (_, n) => ({ id: String(n), expectedIsRead: false })),
    [
      { id: "same", expectedIsRead: false },
      { id: "same", expectedIsRead: false },
    ],
  ].map((items) => ({ items })),
)("refuses unsafe selections at the storage boundary", async ({ items }) => {
  await expect(repo.setInboxReadState("actor", { isRead: true, items })).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(state.queries).toHaveLength(0);
});
