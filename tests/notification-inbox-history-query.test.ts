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
const asOf = "2026-10-13T00:00:00.123456Z",
  windowFrom = "2026-10-06T00:00:00.123456Z";
const periodHash = (period = "7", anchor = asOf, actor = "actor") =>
  createHash("sha256")
    .update(JSON.stringify([2, "notification-inbox", actor, "", "all", "all", period, anchor]))
    .digest("hex");
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it.each(["7", "30", "90", "365"] as const)(
  "anchors period %s in a single read-only database snapshot without host-clock arithmetic",
  async (period) => {
    state.rows = [
      [[asOf, windowFrom, asOf]],
      Array.from({ length: 26 }, (_, n) => row(`id_${26 - n}`)),
      [["30"]],
    ];
    const page = await repo.pageInbox("actor", { ...filters, period });
    expect(page.window).toEqual({ from: windowFrom, until: asOf });
    expect(page.items).toHaveLength(25);
    expect(page.unreadCount).toBe(30);
    expect(JSON.parse(page.olderCursor ?? "")).toMatchObject({
      context: periodHash(period),
      asOf,
      version: 1,
    });
    expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
    expect(state.queries).toHaveLength(3);
    expect(state.queries[0].sql).toContain("statement_timestamp()");
    expect(state.queries[0].sql).toContain("interval '24 hours'");
    expect(state.queries[0].params).toEqual([null, Number(period), null]);
    expect(state.queries[1].params).toEqual(["actor", windowFrom, asOf, 26]);
    expect(state.queries[1].sql).toMatch(/>= .*::timestamptz.*<= .*::timestamptz/);
    expect(state.queries[2].params).toEqual(["actor"]);
    expect(state.queries[2].sql).not.toContain("timestamptz");
  },
);
it.each(["older", "newer"] as const)(
  "retains the original period through %s navigation after the database clock advances",
  async (direction) => {
    const later = "2026-10-14T00:00:00.123456Z";
    state.rows = [[[later, windowFrom, asOf]], [row("one")], [["2"]]];
    const cursor = {
      id: "anchor",
      createdAt: "2026-10-11T00:00:00.123456Z",
      direction,
      context: periodHash(),
      asOf,
    };
    const page = await repo.pageInbox("actor", { ...filters, period: "7", cursor });
    expect(page.window).toEqual({ from: windowFrom, until: asOf });
    expect(state.queries[0].params).toEqual([asOf, 7, asOf]);
    expect(state.queries[1].params).toEqual([
      "actor",
      windowFrom,
      asOf,
      cursor.createdAt,
      "anchor",
      26,
    ]);
  },
);
it("uses an explicit first-page anchor for export without depending on a cursor row", async () => {
  state.rows = [[[asOf, windowFrom, asOf]], [], [["0"]]];
  expect((await repo.pageInbox("actor", { ...filters, period: "7", at: asOf })).window).toEqual({
    from: windowFrom,
    until: asOf,
  });
  expect(state.queries[0].params).toEqual([asOf, 7, asOf]);
  expect(state.queries[1].sql).not.toContain('("notifications"."created_at","notifications"."id")');
});
it.each(["period", "anchor", "actor", "missing-anchor", "different-at"])(
  "rejects a changed %s cursor context before SQL",
  async (change) => {
    const cursor = {
      id: "anchor",
      createdAt: asOf,
      direction: "older" as const,
      context: periodHash(),
      asOf:
        change === "missing-anchor"
          ? undefined
          : change === "anchor"
            ? "2026-10-13T00:00:00.123455Z"
            : asOf,
    };
    await expect(
      repo.pageInbox(change === "actor" ? "foreign" : "actor", {
        ...filters,
        period: change === "period" ? "30" : "7",
        cursor,
        ...(change === "different-at" ? { at: "2026-10-13T00:00:00.123455Z" } : {}),
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it("rejects a future anchored period before selecting private messages or unread counts", async () => {
  state.rows = [[["2026-10-13T00:00:00.123455Z", windowFrom, asOf]]];
  await expect(
    repo.pageInbox("actor", { ...filters, period: "7", at: asOf }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
it.each([{ period: "1" }, { period: "all", at: asOf }, { period: "7", at: "bad" }])(
  "fails invalid window scope %j before SQL",
  async (input) => {
    await expect(
      repo.pageInbox("actor", { ...filters, ...input } as Parameters<typeof repo.pageInbox>[1]),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it.each(
  [
    [null, windowFrom, asOf],
    [asOf, "bad", asOf],
    [asOf, windowFrom, null],
  ].map((clock) => ({ clock })),
)("refuses invalid database-clock metadata %# without reading the inbox", async ({ clock }) => {
  state.rows = [[clock]];
  await expect(repo.pageInbox("actor", { ...filters, period: "7" })).rejects.toMatchObject({
    code: "INTERNAL_ERROR",
  });
  expect(state.queries).toHaveLength(1);
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
