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
      throw new Error("write failed");
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
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: state.push,
}));

import { db } from "../packages/db/src/client";
import { storeOrganizationAccessNotice } from "../packages/db/src/repositories/organization-access-notice";
import { organizationGovernanceRepository as repository } from "../packages/db/src/repositories/organization-governance";
import { organizationWorkspaceRepository as workspace } from "../packages/db/src/repositories/organization-workspace";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import { organizations } from "../packages/db/src/schema";

const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:01.000Z";
const org = (extra = {}) =>
  Object.keys(getTableColumns(organizations)).map(
    (key) =>
      ({
        id: "org",
        name: "Team",
        slug: "team",
        ownerId: "owner",
        description: null,
        logoUrl: null,
        websiteUrl: null,
        isVerified: true,
        createdAt: time,
        updatedAt: time,
        ...extra,
      })[key as "id"],
  );
const input = {
  id: "org",
  actorId: "owner",
  currentToken: "raw-owner-token",
  targetId: "target",
  targetUsername: "target",
  confirmationSlug: "team",
  formerOwnerRole: "member" as const,
  expectedUpdatedAt: new Date(time),
  memberId: "new-membership",
  auditId: "audit",
};
const writes = (table: string) =>
  state.queries.filter(
    (query) =>
      query.sql.startsWith(`insert into "${table}"`) || query.sql.startsWith(`update "${table}"`),
  );
function transferRows(
  members = [
    ["old-membership", "owner", "owner"],
    ["target-membership", "target", "developer"],
  ],
) {
  state.rows = [
    [org()],
    members,
    [
      ["owner", "owner", "Owner", null],
      ["target", "target", "Target", null],
    ],
    [["session", new Date(Date.now() + 3_600_000).toISOString()]],
    [org({ ownerId: "target", updatedAt: later })],
  ];
}
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = null;
  state.failTable = "";
  state.push.mockReset().mockResolvedValue({ queued: 0, reason: "no_subscriptions" });
});
it("locks organization, stable memberships and actors, then the owned session before writes", async () => {
  transferRows();
  const result = await repository.transfer(input);
  expect(result).toMatchObject({
    role: "member",
    previousOwnerId: "owner",
    organization: { ownerId: "target" },
    owner: { id: "target" },
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain('order by "organization_members"."user_id" asc');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].params).toEqual(["owner", "target"]);
  expect(state.queries[2].sql).toContain('order by "users"."id" asc');
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain('from "sessions"');
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[3].params).toEqual([
    "owner",
    digestSessionToken(input.currentToken),
    expect.any(String),
  ]);
  expect(state.queries[4].sql).toContain('update "organization_members"');
  expect(JSON.stringify(state.queries)).not.toContain(input.currentToken);
  for (const update of writes("organization_members")) {
    expect(update.sql).toContain('set "role" =');
    expect(update.sql).not.toContain("permissions");
  }
  expect(writes("organizations")[0].sql).toContain("interval '1 millisecond'");
  expect(writes("organizations")[0].sql).not.toMatch(/"is_verified" =|"slug" =|"name" =/u);
  expect(writes("audit_events")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(2);
  expect(state.push).toHaveBeenCalledTimes(2);
});
it("repairs a missing legacy owner membership and assigns the explicit retained role", async () => {
  transferRows([["target-membership", "target", "admin"]]);
  const result = await repository.transfer({ ...input, formerOwnerRole: "admin" });
  expect(result.role).toBe("admin");
  const repair = writes("organization_members").find((query) => query.sql.startsWith("insert"));
  expect(repair?.params).toEqual(
    expect.arrayContaining(["new-membership", "org", "owner", "admin", "[]"]),
  );
});
it.each(["admin", "developer", "member", "owner"])(
  "never grants ownership transfer from a nonowner membership %s",
  async (role) => {
    state.rows = [[org()], [[role]]];
    await expect(repository.transfer({ ...input, actorId: "other" })).rejects.toMatchObject({
      code: role === "owner" ? "FORBIDDEN" : "OWNERSHIP_OWNER_REQUIRED",
    });
    expect(writes("organizations")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it.each([
  { expectedUpdatedAt: new Date(later), code: "CONFLICT" },
  { confirmationSlug: "wrong", code: "OWNERSHIP_CONFIRMATION_REQUIRED" },
  { targetId: "owner", code: "OWNERSHIP_TARGET_INVALID" },
])(
  "rejects stale versions, wrong confirmation and self transfer before child writes %j",
  async ({ code, ...extra }) => {
    state.rows = [[org()]];
    await expect(repository.transfer({ ...input, ...extra })).rejects.toMatchObject({ code });
    expect(state.queries).toHaveLength(1);
  },
);
it.each([
  { members: [] },
  { members: [["target-membership", "target", "owner"]] },
  { members: [["target-membership", "target", "legacy"]] },
])("requires a current eligible member %j", async ({ members }) => {
  state.rows = [[org()], members];
  await expect(repository.transfer(input)).rejects.toMatchObject({
    code: "OWNERSHIP_TARGET_INVALID",
  });
  expect(writes("organization_members")).toHaveLength(0);
});
it("rejects a changed username before transfer rather than resolving another account", async () => {
  state.rows = [
    [org()],
    [["membership", "target", "member"]],
    [
      ["owner", "owner", "Owner", null],
      ["target", "changed", "Target", null],
    ],
  ];
  await expect(repository.transfer(input)).rejects.toMatchObject({
    code: "OWNERSHIP_TARGET_INVALID",
  });
  expect(writes("audit_events")).toHaveLength(0);
});
it("rejects a missing token before querying or an absent current session before any write", async () => {
  await expect(repository.transfer({ ...input, currentToken: "" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.queries).toHaveLength(0);
  transferRows();
  state.rows[3] = [];
  await expect(repository.transfer(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(state.queries).toHaveLength(4);
  expect(writes("organization_members")).toHaveLength(0);
  expect(writes("organizations")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it.each(["audit_events", "notifications"])(
  "does not confirm a transfer when authoritative %s storage fails",
  async (failTable) => {
    transferRows();
    state.failTable = failTable;
    await expect(repository.transfer(input)).rejects.toMatchObject({
      cause: expect.objectContaining({ message: "write failed" }),
    });
  },
);
it("preserves both inbox messages on optional push failure but propagates intent failure", async () => {
  transferRows();
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect((await repository.transfer(input)).organization.ownerId).toBe("target");
  expect(writes("notifications")).toHaveLength(2);
  expect(warn).toHaveBeenCalledTimes(2);
  transferRows();
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(repository.transfer(input)).rejects.toThrow("Admission intent failed");
  warn.mockRestore();
});
it("records access notices in the same transaction for team changes and uses safe revoked-access links", async () => {
  state.rows = [
    [org()],
    [["target", "target", "Target", null]],
    [["membership"]],
    [org({ updatedAt: later })],
  ];
  await workspace.addMember(
    "org",
    "owner",
    new Date(time),
    "target",
    "member",
    false,
    "membership",
    {
      id: "audit",
      actorId: "owner",
      actorType: "user",
      targetType: "organization",
      targetId: "org",
      action: "organization.member_added",
    },
  );
  const notice = writes("notifications")[0];
  expect(notice.params).toContain("Organization org: added.");
  expect(notice.params).toContain("/workspace/organizations/org");
  expect(notice.params.join(" ")).not.toContain("permissions");
});
it.each(["removed", "left"] as const)(
  "uses a public organization link and a bounded deterministic notice ID for %s",
  async (change) => {
    const target = "x".repeat(128);
    await db.transaction((tx) =>
      storeOrganizationAccessNotice(
        tx,
        { id: "org", slug: "team" },
        target,
        change,
        "a".repeat(128),
      ),
    );
    const first = writes("notifications")[0];
    expect(first.params).toContain("/organizations/team");
    const id = first.params.find(
      (value) => typeof value === "string" && value.startsWith("ntf_org_access_"),
    ) as string;
    expect(id.length).toBeLessThanOrEqual(128);
    state.queries = [];
    await db.transaction((tx) =>
      storeOrganizationAccessNotice(
        tx,
        { id: "org", slug: "team" },
        target,
        change,
        "a".repeat(128),
      ),
    );
    expect(writes("notifications")[0].params).toContain(id);
  },
);
it("reads manager-scoped history in a snapshot with explicit privacy-safe projections and stable keysets", async () => {
  state.rows = [[org()], [["anchor", "2026-10-11T00:00:00.123456Z"]], []];
  await repository.history("org", "owner", "anchor");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const anchor = state.queries[1];
  expect(anchor.params).toEqual(expect.arrayContaining(["organization", "org", "anchor"]));
  const page = state.queries[2];
  expect(page.params).toEqual(
    expect.arrayContaining(["2026-10-11T00:00:00.123456Z", "anchor", 21]),
  );
  expect(page.sql).toContain('order by "audit_events"."created_at" desc, "audit_events"."id" desc');
  expect(page.sql.split(' from "audit_events"')[0]).not.toMatch(
    /"details"[, ]|ip_address|user_agent|password|email|permissions/u,
  );
  expect(page.sql).toContain("jsonb_typeof");
  expect(page.sql).toContain("limit 4");
});
it.each(["member", "developer", "owner"])(
  "denies private history for nonmanager or stale owner membership %s",
  async (role) => {
    state.rows = [[org()], [[role]]];
    await expect(repository.history("org", "other")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects foreign/missing anchors without falling back to another organization's history", async () => {
  state.rows = [[org()], []];
  await expect(repository.history("org", "owner", "foreign")).rejects.toMatchObject({
    code: "ORGANIZATION_HISTORY_EXPIRED",
  });
  expect(state.queries).toHaveLength(2);
  state.queries = [];
  await expect(repository.history("org", "owner", "bad/id")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(state.queries).toHaveLength(0);
});
it("returns only twenty events and the actual final displayed ID as the next cursor", async () => {
  state.rows = [
    [org()],
    Array.from({ length: 21 }, (_, index) => [
      `audit_${index}`,
      "organization.member_left",
      time,
      "actor",
      "Actor",
      null,
      null,
      "member",
      null,
      null,
      [],
    ]),
  ];
  const page = await repository.history("org", "owner");
  expect(page.items).toHaveLength(20);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toBe("audit_19");
});
