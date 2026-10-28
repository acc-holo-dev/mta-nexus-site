import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  failTable: "",
  push: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failTable && sql.startsWith(`insert into "${state.failTable}"`))
      throw new Error("storage failed");
    if (sql.includes('from "sessions"')) return { rows: [["session", "2099-01-01T00:00:00.000Z"]] };
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown, config: unknown) => {
          if (config) state.config = config;
          return callback(proxy);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});
vi.mock("../packages/db/src/repositories/web-push-outbox", () => ({
  enqueueWebPushOutboxForNotification: state.push,
}));

import { supportCaseRepository as cases } from "../packages/db/src/repositories/support";
import { supportActivityRepository as activity } from "../packages/db/src/repositories/support-activity";
import { supportCases } from "../packages/db/src/schema";

const id = `sup_${"a".repeat(24)}`,
  time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:01.000Z";
const row = (extra = {}) =>
  Object.keys(getTableColumns(supportCases)).map(
    (key) =>
      ({
        id,
        requesterId: "owner",
        category: "account",
        subject: "Private subject",
        status: "open",
        relatedType: null,
        relatedId: null,
        createdAt: time,
        updatedAt: time,
        ...extra,
      })[key as "id"],
  );
const audit = {
  id: "audit",
  actorId: "owner",
  actorType: "user" as const,
  action: "support.case.status_changed",
  targetId: id,
  targetType: "support_case",
  details: { secret: "never persist" },
};
const writes = (table: string) =>
  state.queries.filter(
    (q) => q.sql.startsWith(`insert into "${table}"`) || q.sql.startsWith(`update "${table}"`),
  );
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = null;
  state.failTable = "";
  state.push.mockReset().mockResolvedValue({ queued: 0, reason: "no_subscriptions" });
});
it("resolves an own case under actor/case locks and saves audit plus a generic transactional notice", async () => {
  state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
  const result = await cases.updateStatus(
    id,
    "resolved",
    audit,
    "open",
    "current-token",
    new Date(time),
  );
  expect(result?.status).toBe("resolved");
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("for update");
  expect(writes("support_cases")[0].sql).toContain("interval '1 millisecond'");
  expect(writes("audit_events")[0].params).toContain(
    JSON.stringify({ from: "open", to: "resolved" }),
  );
  expect(writes("audit_events")[0].params.join()).not.toContain("secret");
  const notice = writes("notifications")[0];
  expect(notice.params).toContain(`Support case ${id}: resolved.`);
  expect(notice.params).not.toContain("Private subject");
  expect(state.push).toHaveBeenCalledTimes(1);
});
it.each(["open", "resolved"] as const)(
  "allows current owners to transition to %s with a revision",
  async (status) => {
    const from = status === "open" ? "resolved" : "open";
    state.rows = [
      [["owner", "user"]],
      [row({ status: from })],
      [row({ status, updatedAt: later })],
    ];
    expect(
      (await cases.updateStatus(id, status, audit, from, "current-token", new Date(time)))?.status,
    ).toBe(status);
  },
);
it.each([
  { status: "closed" as const, from: "open" as const, version: time },
  { status: "open" as const, from: "closed" as const, version: time },
  { status: "resolved" as const, from: "open" as const, version: undefined },
])(
  "forbids requester closure, staff-closed reopening and unversioned self-service: %j",
  async (input) => {
    state.rows = [[["owner", "user"]], [row({ status: input.from })]];
    await expect(
      cases.updateStatus(
        id,
        input.status,
        audit,
        input.from,
        "current-token",
        input.version ? new Date(input.version) : undefined,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(writes("support_cases")).toHaveLength(0);
  },
);
it("denies an unrelated user, including a moderator whose role was revoked before the write", async () => {
  state.rows = [[["staff", "user"]], [row()]];
  await expect(
    cases.updateStatus(id, "closed", { ...audit, actorId: "staff" }, "open", "current-token"),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(writes("support_cases")).toHaveLength(0);
});
it("allows live staff to close cases and produces a staff-attributed audit", async () => {
  state.rows = [[["staff", "moderator"]], [row()], [row({ status: "closed", updatedAt: later })]];
  await cases.updateStatus(
    id,
    "closed",
    { ...audit, actorId: "staff" },
    "open",
    "current-token",
    new Date(time),
  );
  expect(writes("audit_events")[0].params).toContain("admin");
});
it.each(["status", "revision"])(
  "rejects a stale %s before audit, status or inbox writes",
  async (stale) => {
    state.rows = [
      [["owner", "user"]],
      [row(stale === "status" ? { status: "resolved" } : { updatedAt: later })],
    ];
    expect(
      await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)),
    ).toBeNull();
    expect(writes("support_cases")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it("rechecks authority and revision for a no-op without creating duplicate audit or notices", async () => {
  state.rows = [[["owner", "user"]], [row({ status: "resolved" })]];
  expect(
    (await cases.updateStatus(id, "resolved", audit, "resolved", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(writes("support_cases")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
});
it.each(["audit_events", "notifications"])(
  "propagates %s failure instead of reporting a saved transition",
  async (table) => {
    state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
    state.failTable = table;
    await expect(
      cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ message: "storage failed" }) });
  },
);
it("isolates optional push failure after authoritative inbox storage", async () => {
  state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
  state.push.mockRejectedValue(new Error("push unavailable"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(
    (await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(writes("notifications")).toHaveLength(1);
  expect(warning).toHaveBeenCalled();
  warning.mockRestore();
});
const reply = {
  id: "message",
  caseId: id,
  authorId: "staff",
  authorRole: "staff" as const,
  body: "Sensitive reply",
  expectedStatus: "open" as const,
  expectedUpdatedAt: new Date(time),
};
const request = {
  actorId: "staff",
  requestKey: "request",
  operation: "reply" as const,
  fingerprint: "fingerprint",
  caseId: id,
  messageId: "message",
};
it("persists staff replies, reservation, audit and requester notification under live authority", async () => {
  state.rows = [
    [["staff", "moderator"]],
    [row()],
    [["request"]],
    [row({ updatedAt: later })],
    [["message", id, "staff", "staff", "Sensitive reply", later]],
  ];
  expect(
    (
      await cases.addIdempotentMessage(
        reply,
        { ...audit, actorId: "staff" },
        request,
        "current-token",
      )
    ).kind,
  ).toBe("created");
  expect(writes("support_mutation_requests")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(1);
  expect(writes("notifications")[0].params.join()).not.toContain("Sensitive reply");
  expect(writes("audit_events")[0].params).toContain("admin");
});
it("refuses forged staff author labels even for an authorized requester", async () => {
  state.rows = [[["owner", "user"]], [row()]];
  await expect(
    cases.addIdempotentMessage(
      { ...reply, authorId: "owner" },
      audit,
      {
        ...request,
        actorId: "owner",
      },
      "current-token",
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(writes("support_mutation_requests")).toHaveLength(0);
});
it("returns stale when a same-status case revision changed without writing a reply", async () => {
  state.rows = [[["staff", "moderator"]], [row({ updatedAt: later })], [["request"]]];
  expect(
    (
      await cases.addIdempotentMessage(
        reply,
        { ...audit, actorId: "staff" },
        request,
        "current-token",
      )
    ).kind,
  ).toBe("stale");
  expect(writes("support_case_messages")).toHaveLength(0);
});
it("filters requester search before count and LIMIT with escaped literal wildcards in one snapshot", async () => {
  state.rows = [[[26]], []];
  const page = await cases.pageByRequester("owner", 2, 25, {
    query: "%_\\",
    status: "resolved",
    category: "account",
  });
  expect(page.page).toBe(2);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  for (const q of state.queries) {
    expect(q.sql).toContain('"support_cases"."requester_id" =');
    expect(q.sql).toContain('"support_cases"."subject" ilike');
    expect(q.params).toContain("owner");
    expect(q.params).toContain("%\\%\\_\\\\%");
  }
  expect(state.queries[1].sql).toContain(
    'order by "support_cases"."updated_at" desc, "support_cases"."id" desc',
  );
  expect(state.queries[1].params.slice(-2)).toEqual([25, 25]);
});
it("refuses a revoked staff queue before selecting any case", async () => {
  state.rows = [[["staff", "user"]]];
  await expect(cases.pageStaff(1, 25, {}, "staff")).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(1);
});
it("returns only status labels with bounded history and an opaque cursor after private access", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    Array.from({ length: 21 }, (_, i) => [`audit_${i}`, "open", "resolved", "staff", time]),
  ];
  const result = await activity.history(id, "owner");
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toBe("audit_19");
  const q = state.queries.at(-1);
  if (!q) throw new Error("Missing query");
  expect(q.params).toContain(id);
  expect(q.params.at(-1)).toBe(21);
  expect(q.params).toContain("support.case.status_changed");
  expect(q.sql).not.toContain('"audit_events"."details",');
  expect(q.sql).not.toContain('"audit_events"."ip_address"');
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it("resolves a history cursor only inside the same case and preserves microseconds", async () => {
  state.rows = [[["owner", "user"]], [row()], [["anchor", "2026-10-11T00:00:00.123456Z"]], []];
  await activity.history(id, "owner", "anchor");
  expect(state.queries[2].params).toContain(id);
  expect(state.queries[2].sql).toContain("HH24:MI:SS.US");
  expect(state.queries[3].params).toContain("2026-10-11T00:00:00.123456Z");
});
it("reports foreign or expired history anchors rather than silently returning another page", async () => {
  state.rows = [[["owner", "user"]], [row()], []];
  await expect(activity.history(id, "owner", "missing")).rejects.toMatchObject({
    code: "SUPPORT_ACTIVITY_EXPIRED",
  });
  expect(state.queries).toHaveLength(3);
});

it("honors system-notification opt-out under the existing preference lock without undoing the status write", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [row({ status: "resolved", updatedAt: later })],
    [[false]],
  ];
  expect(
    (await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(state.queries.some((q) => q.sql.includes("pg_advisory_xact_lock"))).toBe(true);
  expect(writes("notifications")).toHaveLength(0);
  expect(state.push).not.toHaveBeenCalled();
});
