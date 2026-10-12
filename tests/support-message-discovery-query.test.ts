import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { supportCases } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
vi.mock("../packages/db/src/repositories/web-push-outbox", () => ({
  enqueueWebPushOutboxForNotification: vi.fn(),
}));

import { supportCaseRepository as cases } from "../packages/db/src/repositories/support";
import { supportMessageDiscoveryRepository as discovery } from "../packages/db/src/repositories/support-message-discovery";

const id = `sup_${"a".repeat(24)}`,
  messageId = `spm_${"b".repeat(24)}`,
  stamp = "2026-10-12T00:00:00.123456Z",
  base = { group: "all" as const, query: "" };
const row = (extra = {}) =>
  Object.keys(getTableColumns(supportCases)).map(
    (key) =>
      ({
        id,
        requesterId: "owner",
        subject: "Private case",
        category: "account",
        status: "open",
        relatedType: "purchase",
        relatedId: "private-order",
        createdAt: stamp,
        updatedAt: stamp,
        ...extra,
      })[key as "id"],
  );
const fingerprint = (actor = "owner", group = "all", query = "") =>
  createHash("sha256")
    .update(JSON.stringify([1, "support-messages", actor, id, "all", group, query]))
    .digest("hex");
const cursor = {
  version: 1 as const,
  context: fingerprint(),
  until: stamp,
  id: messageId,
  direction: "older" as const,
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = undefined;
});
it("checks live ownership before any message reads and uses one read-only snapshot", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
  expect(await discovery.page(id, "owner", base)).toMatchObject({
    supportCase: { id, subject: "Private case", status: "open" },
    items: [],
    until: stamp,
    olderCursor: null,
    newerCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[3].params).toEqual([id, stamp, 20]);
  expect(state.queries[3].sql).toContain("left(");
  expect(state.queries[3].sql).not.toMatch(/author_id|related_id|requester_id|offset|count\(/u);
});
it.each(["outsider", "revoked-staff"])("denies %s before reading messages", async (actor) => {
  state.rows = [[[actor, "user"]], [row()]];
  await expect(discovery.page(id, actor, base)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
});
it("denies a deleted session actor and restricts the staff surface even for an owner", async () => {
  state.rows = [[]];
  await expect(discovery.page(id, "deleted", base)).rejects.toMatchObject({ statusCode: 401 });
  state.rows = [[["owner", "user"]], [row()]];
  await expect(discovery.page(id, "owner", base, true)).rejects.toMatchObject({ statusCode: 403 });
});
it("allows current moderators without forwarding case relationships or staff identities", async () => {
  state.rows = [
    [["moderator", "moderator"]],
    [row()],
    [[stamp]],
    [[messageId, "staff", "Private reply", false, stamp]],
    [[false, false]],
  ];
  const result = await discovery.page(id, "moderator", base, true);
  expect(result.items).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(
    /moderator|private-order|requesterId|authorId|related/u,
  );
});
it("escapes SQL wildcards literally and combines role/text filters with the case cutoff", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
  await discovery.page(id, "owner", { group: "staff", query: "100%_\\" });
  expect(state.queries[3].params).toEqual([id, stamp, "staff", "%100\\%\\_\\\\%", 20]);
  expect(state.queries[3].sql).toContain("ilike");
});
it.each(["older", "newer"] as const)(
  "resolves %s cursors inside the retained case/filter window",
  async (direction) => {
    const later = "2026-10-12T00:01:00.000000Z";
    state.rows = [[["owner", "user"]], [row()], [[later]], [[messageId, stamp]], []];
    expect(
      (await discovery.page(id, "owner", { ...base, cursor: { ...cursor, direction } })).until,
    ).toBe(stamp);
    expect(state.queries[3].params).toEqual([id, stamp, messageId, 1]);
    expect(state.queries[4].params).toEqual([id, stamp, stamp, messageId, 20]);
    expect(state.queries[4].sql).toContain(direction === "older" ? ") < (" : ") > (");
    expect(state.queries[4].sql).toContain(
      direction === "older" ? '"created_at" desc' : '"created_at" asc',
    );
  },
);
it("includes the focused old message and offers both navigation directions with exact times", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [[stamp]],
    [[messageId, stamp]],
    [[messageId, "requester", "Focused", false, stamp]],
    [[true, true]],
  ];
  const result = await discovery.page(id, "owner", { ...base, focus: messageId });
  expect(result.focus).toBe(messageId);
  expect(result.items[0].createdAt).toBe(stamp);
  expect(result.olderCursor).toEqual(cursor);
  expect(result.newerCursor).toEqual({ ...cursor, direction: "newer" });
  expect(state.queries[4].sql).toContain(") <= (");
  expect(state.queries[5].sql.match(/exists\(/gu)).toHaveLength(2);
});
it.each([
  { cursor: { ...cursor, context: fingerprint("another") } },
  { cursor, query: "changed" },
  { cursor, group: "staff" as const },
  { cursor: { ...cursor, id: "../secret" } },
  { focus: messageId, query: "incompatible" },
])("rejects a reused or malformed context before storage: %j", async (extra) => {
  await expect(discovery.page(id, "owner", { ...base, ...extra })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it.each([false, true])(
  "rejects missing scoped anchors without exposing another case (focus %s)",
  async (focus) => {
    state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
    await expect(
      discovery.page(id, "owner", { ...base, ...(focus ? { focus: messageId } : { cursor }) }),
    ).rejects.toMatchObject({ statusCode: focus ? 404 : 410 });
    expect(state.queries).toHaveLength(4);
  },
);
it("rejects a future snapshot before reading messages", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]]];
  await expect(
    discovery.page(id, "owner", { ...base, until: "9999-01-01T00:00:00.000000Z" }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(3);
});
it("caps legacy Unicode text without splitting surrogate pairs", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [[stamp]],
    [[messageId, "requester", `${"x".repeat(3999)}😀suffix`, false, stamp]],
    [[false, false]],
  ];
  const result = await discovery.page(id, "owner", base);
  expect(result.items[0]).toMatchObject({ body: "x".repeat(3999), truncated: true });
});
it("authorizes the existing reply thread from live data and keeps count/page in the same snapshot", async () => {
  state.rows = [[["owner", "user"]], [row()], [[601]], []];
  const result = await cases.authorizedThread(id, "owner", 7);
  expect(result).toMatchObject({
    requester: true,
    staff: false,
    messages: { page: 7, pageSize: 100, total: 601, totalPages: 7 },
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[3].params).toEqual([id, 100, 600]);
});
