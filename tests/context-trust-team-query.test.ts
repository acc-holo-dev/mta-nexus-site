import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
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
          return (work: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
vi.mock("../packages/db/src/repositories/organization-access-notice", () => ({
  storeOrganizationAccessNotice: vi.fn(),
}));
import { publicContextTrustRepository as trust } from "../packages/db/src/repositories/public-context-trust";
import { organizationTeamDirectoryRepository as team } from "../packages/db/src/repositories/organization-team-directory";
import { organizations } from "../packages/db/src/schema";
const time = "2026-10-11T00:00:00.123456Z";
const org = {
  id: "org",
  name: "Team",
  slug: "team",
  description: null,
  logoUrl: null,
  websiteUrl: null,
  isVerified: false,
  ownerId: "owner",
  createdAt: time,
  updatedAt: time,
};
function access(actor = "owner", role = "member") {
  state.rows = [
    [Object.keys(getTableColumns(organizations)).map((key) => org[key as keyof typeof org])],
  ];
  if (actor !== "owner") state.rows.push([[role]]);
}
const context = (kind: string, id = "subject") =>
  createHash("sha256")
    .update(JSON.stringify([1, "public-context-approvals", kind, id]))
    .digest("hex");
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = [];
});
it("reads organization signals and bounded dated approvals in one repeatable public snapshot", async () => {
  state.rows = [
    [["subject", "team", "Team", time, false, 3, 2, 1]],
    [["b".repeat(32), "organization", time, time]],
  ];
  const page = await trust.page("organization", "team");
  expect(page.subject).toMatchObject({
    kind: "organization",
    verified: false,
    publications: 3,
    servers: { total: 2, verified: 1 },
    organization: null,
    ownershipKind: null,
  });
  expect(page.context).toBe(context("organization"));
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  expect(state.queries[0].sql).toContain('"public_servers"."visibility" = \'public\'');
  expect(state.queries[0].sql).toContain('"public_servers"."status" = \'active\'');
  expect(state.queries[0].sql).toContain('"public_content"."status" = \'published\'');
  expect(state.queries[0].sql).toContain(
    '"public_servers"."organization_id" = "organizations"."id"',
  );
  expect(state.queries[0].sql).toContain(
    '"public_content"."organization_id" = "organizations"."id"',
  );
  expect(state.queries[0].sql).not.toMatch(
    /organization_members|products|email|owner_id|reputation/u,
  );
  expect(state.queries[1].params).toEqual(["subject", "approved", "organization", 21]);
  expect(state.queries[1].sql).not.toMatch(/proof_url|requester_id|reviewer_id|review_notes/u);
});
it("gates server trust on active public state before any approval lookup and projects no endpoint or personal owner identity", async () => {
  state.rows = [
    [["subject", "server", "Server", time, true, 0, "team", "Team", true, "organization"]],
  ];
  const page = await trust.page("server", "server");
  expect(page.subject.organization).toEqual({ slug: "team", name: "Team", verified: true });
  expect(page.subject.servers).toBeNull();
  expect(state.queries[0].params).toEqual(["server", "public", "active", 1]);
  expect(state.queries[0].sql).not.toMatch(/ip_address|port|claim_challenges|username|email/u);
  expect(state.queries[0].sql).toContain('"public_content"."server_id" = "servers"."id"');
  expect(state.queries[1].params).toEqual(["subject", "approved", "server", 21]);
});
it.each(["organization", "server"] as const)(
  "returns 404 for missing/hidden %s without reading approvals",
  async (kind) => {
    await expect(trust.page(kind, "hidden")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.queries).toHaveLength(1);
  },
);
it.each([context("organization"), context("server", "other")])(
  "rejects cross-kind/target context replay after narrow subject resolution",
  async (bound) => {
    state.rows = [[["subject", "server", "Server", time, false, 0, null, null, null, "unclaimed"]]];
    await expect(
      trust.page("server", "server", { createdAt: time, id: "a".repeat(32), context: bound }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("uses twenty approval records, opaque tie keys and exact database microseconds", async () => {
  state.rows = [
    [["subject", "team", "Team", time, false, 0, 0, 0]],
    Array.from({ length: 21 }, (_, i) => [
      i.toString(16).padStart(32, "0"),
      "organization",
      time,
      time,
    ]),
  ];
  const page = await trust.page("organization", "team", {
    createdAt: time,
    id: "f".repeat(32),
    context: context("organization"),
  });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: (19).toString(16).padStart(32, "0") });
  expect(state.queries[1].sql).toContain('md5("verification_requests"."id")');
  expect(state.queries[1].sql).toContain("US");
  expect(state.queries[1].sql).not.toContain("offset");
});
it("scopes team filters to current organization authority and retains only public identities plus server-access booleans", async () => {
  access("reader", "member");
  state.rows.push([["owner", "boss", "Boss", null]], []);
  await team.page("org", "reader", { query: "%_", role: "developer", access: "yes" });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[1].params).toEqual(["org", "reader", 1]);
  const query = state.queries[3];
  expect(query.params).toEqual(
    expect.arrayContaining(["org", "owner", "%\\%\\_%", "developer", 21]),
  );
  expect(query.sql).toContain("in ('member','developer')");
  expect(query.sql).toContain("= 'admin'");
  expect(query.sql).toContain('["manage_servers"]');
  expect(query.sql).not.toMatch(/email|password|offset|balance|manage_products|manage_commerce/u);
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
});
it.each(["owner", "custom", ""])(
  "denies stale/unsupported membership %s without reading the team",
  async (role) => {
    access("admin-account", role);
    await expect(team.page("org", "admin-account", { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects another account/filter cursor before reading identities or members", async () => {
  access();
  await expect(
    team.page("org", "owner", {
      query: "Lua",
      cursor: { createdAt: time, id: "membership", context: "a".repeat(64) },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
it("bounds member pages and uses the membership key rather than the displayed user ID", async () => {
  access();
  state.rows.push(
    [["owner", "boss", "Boss", null]],
    Array.from({ length: 21 }, (_, i) => [
      `user-${i}`,
      `user${i}`,
      "User",
      null,
      "admin",
      false,
      true,
      time,
      `membership-${i}`,
      time,
    ]),
  );
  const page = await team.page("org", "owner", { query: "", role: "other", access: "no" });
  expect(page.members).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "membership-19" });
  expect(state.queries[2].sql).toContain("not in ('admin','developer','member')");
  expect(state.queries[2].sql).toContain("not (");
});
