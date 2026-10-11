import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failed");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
vi.mock("../packages/db/src/repositories/web-push-outbox", () => ({
  enqueueWebPushOutboxForNotification: async () => ({ queued: 0, reason: "no_subscriptions" }),
}));

import { developerExperienceRevision } from "../packages/db/src/repositories/developer-profile";
import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { verificationApplicationRevision as version } from "../packages/db/src/repositories/verification-application-version";
import { verificationWorkspaceRepository as repo } from "../packages/db/src/repositories/verification-workspace";
import { verificationRequests } from "../packages/db/src/schema";

const time = "2026-10-11T00:00:00.123456Z",
  filters = { query: "", status: "all", type: "all" },
  context = createHash("sha256")
    .update(JSON.stringify([1, "verification-applications", "actor", "", "all", "all"]))
    .digest("hex");
const stamp = developerExperienceRevision({
  specialties: ["Lua"],
  githubUrl: "https://example.test",
});
const request = (extra: Record<string, unknown> = {}) => {
  const fields: Record<string, unknown> = {
    id: "request",
    requesterId: "actor",
    targetId: "actor",
    targetType: "developer",
    status: "pending",
    createdAt: time,
    ...extra,
  };
  return Object.keys(getTableColumns(verificationRequests)).map((key) => fields[key] ?? null);
};
const input = {
    expectedRevision: version("request", "pending", "submission"),
    proofUrl: "https://example.test/proof",
    notes: "Complete replacement evidence",
  },
  audit = {
    id: "new-audit",
    actorId: "actor",
    actorType: "user" as const,
    action: "verification.application_updated",
    targetId: "request",
    targetType: "verification",
  };
const writes = (table: string) =>
  state.queries.filter(
    (query) =>
      query.sql.startsWith(`update "${table}"`) || query.sql.startsWith(`insert into "${table}"`),
  );
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
  state.failAudit = false;
});
it("bounds own history at twenty summaries with exact stable keyset order and no account or evidence URL", async () => {
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [
      `request_${21 - index}`,
      "developer",
      "pending",
      time,
      null,
      "Excerpt",
    ]),
  ];
  const result = await repo.applications("actor", filters);
  expect(result.items).toHaveLength(20);
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    context,
    createdAt: time,
    id: "request_2",
    direction: "older",
  });
  expect(state.queries).toHaveLength(1);
  const query = state.queries[0];
  expect(query.sql).not.toContain("offset");
  expect(query.sql.split(" from ")[0]).not.toMatch(
    /requester_id|reviewer_id|proof_url|details|email/u,
  );
  expect(query.params).toContain("actor");
  expect(query.params.at(-1)).toBe(21);
});
it("escapes search and filters before limiting, and reads nearest newer rows without an anchor lookup", async () => {
  await repo.applications("actor", { query: "%_\\", status: "pending", type: "developer" });
  expect(state.queries[0].params).toEqual(
    expect.arrayContaining(["%\\%\\_\\\\%", "pending", "developer", 21]),
  );
  state.queries = [];
  state.rows = [
    [
      ["near", "developer", "pending", time, null, ""],
      ["latest", "developer", "pending", time, null, ""],
    ],
  ];
  const result = await repo.applications("actor", {
    ...filters,
    cursor: { id: "removed", createdAt: time, context, direction: "newer" },
  });
  expect(result.items.map((item) => item.id)).toEqual(["latest", "near"]);
  expect(result.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain(") > (");
  expect(state.queries[0].sql).toContain('"created_at" asc, "verification_requests"."id" asc');
});
it.each(["actor", "type", "status", "query"])(
  "rejects history cursor context changes %s before SQL",
  async (changed) => {
    await expect(
      repo.applications(changed === "actor" ? "foreign" : "actor", {
        ...filters,
        [changed]: "changed",
        cursor: { id: "request", createdAt: time, context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it("denies foreign detail before reading audit or professional data", async () => {
  await expect(repo.application("foreign", "request")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("foreign");
});
it.each([stamp, "outdated", null])(
  "compares submitted evidence to current profile and returns only twenty narrow activity events (%s)",
  async (submitted) => {
    state.rows = [
      [
        [
          "request",
          "developer",
          "actor",
          "pending",
          "https://example.test",
          "notes",
          null,
          false,
          time,
          null,
          "submission",
          submitted,
        ],
      ],
      [[["Lua"], "https://example.test"]],
      Array.from({ length: 21 }, (_, i) => [
        `audit_${i}`,
        "verification.application_updated",
        time,
      ]),
    ];
    const result = await repo.application("actor", "request");
    expect(result.profileState).toBe(
      submitted === stamp ? "current" : submitted ? "changed" : "unknown",
    );
    expect(result.events).toHaveLength(20);
    expect(result.hasEarlierEvents).toBe(true);
    expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
    const selected = state.queries[2].sql.split(" from ")[0];
    expect(selected).not.toMatch(/actor_id|details|ip_address|user_agent/u);
    expect(state.queries[0].sql).toContain("left join lateral");
  },
);
it("locks ownership and current profile before replacing only evidence, with a monotonically ordered mandatory audit stamp", async () => {
  state.rows = [
    [request()],
    [["submission"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
  ];
  expect(await repo.amend("actor", "request", input, audit)).toEqual({
    id: "request",
    status: "pending",
    revision: version("request", "pending", "new-audit"),
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toContain("actor");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain("for share");
  const set = writes("verification_requests")[0].sql.split(" set ")[1].split(" where ")[0];
  expect(set).toContain('"proof_url"');
  expect(set).toContain('"notes"');
  expect(set).not.toMatch(/status|created_at|resolved_at|reviewer_id|requester_id/u);
  expect(writes("audit_events")[0].sql).toContain("interval '1 microsecond'");
  expect(writes("audit_events")[0].params).toContain(
    JSON.stringify({ developerProfileRevision: stamp }),
  );
  expect(writes("audit_events")[0].params).not.toContain(input.proofUrl);
  expect(writes("developer_profiles")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it.each([
  { status: "approved", code: "VERIFICATION_APPLICATION_CHANGED" },
  { status: "rejected", code: "VERIFICATION_APPLICATION_CHANGED" },
  { targetType: "server", code: "VERIFICATION_APPLICATION_READ_ONLY" },
])("rejects resolved or MTA-proof mutations %j", async ({ code, ...extra }) => {
  state.rows = [[request(extra)]];
  await expect(repo.amend("actor", "request", input, audit)).rejects.toMatchObject({ code });
  expect(writes("verification_requests")).toHaveLength(0);
});
it("rejects an obsolete author version before target checks or evidence writes", async () => {
  state.rows = [[request()], [["newer-submission"]]];
  await expect(repo.amend("actor", "request", input, audit)).rejects.toMatchObject({
    code: "VERIFICATION_APPLICATION_CHANGED",
  });
  expect(state.queries).toHaveLength(2);
  expect(writes("verification_requests")).toHaveLength(0);
});
it.each(["member", "owner", null])(
  "requires current organization administration %s",
  async (role) => {
    state.rows = [
      [request({ targetType: "organization", targetId: "org" })],
      [["submission"]],
      [["other-owner", false]],
      role ? [[role]] : [],
    ];
    await expect(repo.amend("actor", "request", input, audit)).rejects.toMatchObject({
      code: "VERIFICATION_AUTHORITY_CHANGED",
    });
    expect(writes("verification_requests")).toHaveLength(0);
  },
);
it("propagates audit failures instead of reporting a saved version", async () => {
  state.rows = [
    [request()],
    [["submission"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
  ];
  state.failAudit = true;
  await expect(repo.amend("actor", "request", input, audit)).rejects.toMatchObject({
    cause: { message: "audit failed" },
  });
});
it.each([undefined, input.expectedRevision])(
  "rejects unbound or stale moderation after an evidence replacement (%s)",
  async (expectedApplicationRevision) => {
    state.rows = [
      [["moderator"]],
      [request({ status: "approved" })],
      [["updated-submission", "verification.application_updated", stamp]],
    ];
    await expect(
      new VerificationRepository().resolveRequest({
        id: "request",
        reviewerId: "reviewer",
        decision: "approved",
        expectedApplicationRevision,
      }),
    ).rejects.toMatchObject({ code: "VERIFICATION_APPLICATION_CHANGED" });
    expect(writes("users")).toHaveLength(0);
    expect(writes("developer_profiles")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it("accepts a fresh version and profile stamp from amended evidence for independent approval", async () => {
  state.rows = [
    [["moderator"]],
    [request({ status: "approved" })],
    [["updated-submission", "verification.application_updated", stamp]],
    [["actor"], ["reviewer"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
    [["actor"]],
    [["moderator"]],
    [["notice", "actor"]],
  ];
  expect(
    (
      await new VerificationRepository().resolveRequest({
        id: "request",
        reviewerId: "reviewer",
        decision: "approved",
        expectedApplicationRevision: version("request", "pending", "updated-submission"),
      })
    )?.status,
  ).toBe("approved");
  expect(writes("developer_profiles")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(1);
});
