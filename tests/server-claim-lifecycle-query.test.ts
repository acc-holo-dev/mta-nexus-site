import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  now: "2026-10-10T12:00:00.000Z",
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    // Moderation now validates the independent reviewer's live role before and
    // after the existing control-proof checks; keep target fixtures separate.
    if (sql.startsWith('select "role" from "users"') && params[0] === "moderator")
      return { rows: [["moderator"]] };
    // The initiating-session lock is not part of the claim-target fixtures.
    if (sql.includes('from "sessions"') && sql.includes("for update"))
      return { rows: [["ses_moderator", "2099-01-01T00:00:00.000Z"]] };
    // These retained server-control cases predate application evidence edits.
    // The new read-only evidence lookup has no row; do not consume target fixtures.
    if (
      sql.startsWith("select") &&
      sql.includes('from "audit_events"') &&
      params.includes("verification.application_updated")
    )
      return { rows: [] };
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const proxy: typeof database = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof database) => unknown) => callback(proxy);
      if (key === "execute")
        return async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
          state.queries.push(dialect.sqlToQuery(query));
          return [{ now: state.now }];
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});
vi.mock("../packages/db/src/repositories/web-push-outbox", () => ({
  enqueueWebPushOutboxForNotification: async () => ({ queued: 0, reason: "no_subscriptions" }),
}));

import { db } from "../packages/db/src/client";
import { assertOrganizationServerClaimAuthority } from "../packages/db/src/repositories/server-claim-authority";
import { ServerClaimChallengeRepository } from "../packages/db/src/repositories/server-claim-challenges";
import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { serverClaimChallenges, servers, verificationRequests } from "../packages/db/src/schema";

const row = (table: PgTable, values: Record<string, unknown>) =>
  Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
const server = (extra: Record<string, unknown> = {}) =>
  row(servers, {
    id: "srv_a",
    name: "Server",
    slug: "server",
    ipAddress: "198.51.100.8",
    port: 22003,
    endpointRevision: 2,
    ownerId: null,
    organizationId: "org_a",
    isVerified: false,
    createdAt: state.now,
    updatedAt: state.now,
    ...extra,
  });
const proof = (extra: Record<string, unknown> = {}) =>
  row(serverClaimChallenges, {
    id: "scc_11111111-1111-4111-8111-111111111111",
    serverId: "srv_a",
    requesterId: "manager",
    tokenDigest: "a".repeat(64),
    proofVersion: 1,
    endpointRevision: 2,
    claimScopeRecorded: true,
    claimOrganizationId: "org_a",
    createdAt: "2026-10-10T11:59:59.000Z",
    expiresAt: "2026-10-10T12:10:00.000Z",
    ...extra,
  });
const request = (extra: Record<string, unknown> = {}) =>
  row(verificationRequests, {
    id: "ver_a",
    requesterId: "manager",
    targetType: "server",
    targetId: "srv_a",
    status: "approved",
    createdAt: state.now,
    resolvedAt: state.now,
    ...extra,
  });
const challengeRepository = new ServerClaimChallengeRepository();
const verificationRepository = new VerificationRepository();
const issue = () =>
  challengeRepository.issue({ serverId: "srv_a", requesterId: "manager", auditId: "aud_issue" });
const consume = () =>
  challengeRepository.consumeVerifiedProof({
    id: "scc_11111111-1111-4111-8111-111111111111",
    serverId: "srv_a",
    requesterId: "manager",
    token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
    sourceFetchedAt: new Date(state.now),
    expectedEndpoint: { ipAddress: "198.51.100.8", port: 22003 },
    verificationRequestId: "ver_a",
    auditId: "aud_proof",
  });
const approve = () =>
  verificationRepository.resolveRequest({
    currentToken: "tok_moderator",
    id: "ver_a",
    reviewerId: "moderator",
    decision: "approved",
  });
const writes = (table: string) =>
  state.queries.filter((query) => new RegExp(`^(?:insert into|update) "${table}"`).test(query.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

it.each([
  ["owner", [[["manager"]]]],
  ["administrator", [[["other"]], [["admin"]]]],
  ["member admin", [[["other"]], [["user"]], [["admin", "[]"]]]],
  ["delegated member", [[["other"]], [["user"]], [["member", '["manage_servers"]']]]],
] as [string, unknown[][][]][])(
  "locks current organization authority for a %s",
  async (_, results) => {
    state.rows = results;
    await db.transaction((tx) => assertOrganizationServerClaimAuthority(tx, "org_a", "manager"));
    for (const query of state.queries) expect(query.sql).toContain("for share");
    expect(state.queries[0].params).toContain("org_a");
    const member = state.queries.find((query) => query.sql.includes('from "organization_members"'));
    if (member) expect(member.params).toEqual(expect.arrayContaining(["org_a", "manager"]));
  },
);
it.each([
  { results: [[]] },
  { results: [[["other"]], [["user"]], []] },
  { results: [[["other"]], [["user"]], [["member", "[]"]]] },
  { results: [[["other"]], [["moderator"]], [["member", '["manage_resources"]']]] },
])("fails closed for missing, revoked or unrelated organization authority", async ({ results }) => {
  state.rows = results;
  await expect(
    db.transaction((tx) => assertOrganizationServerClaimAuthority(tx, "org_a", "manager")),
  ).rejects.toMatchObject({ statusCode: 403, code: "SERVER_CLAIM_AUTHORITY_CHANGED" });
});
it("checks grants before issuing or invalidating any challenge, independent of service pre-checks", async () => {
  state.rows = [[server()], [["other"]], [["user"]], []];
  await expect(issue()).rejects.toMatchObject({ code: "SERVER_CLAIM_AUTHORITY_CHANGED" });
  expect(writes("server_claim_challenges")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
  expect(state.queries[0].sql).toContain("for update");
});
it("records the locked organization scope even with a legacy personal owner", async () => {
  state.rows = [[server({ ownerId: "legacy_owner" })], [["manager"]], []];
  await issue();
  const insert = writes("server_claim_challenges").find((query) => query.sql.startsWith("insert"));
  expect(insert?.sql).toContain('"claim_scope_recorded"');
  expect(insert?.params).toEqual(expect.arrayContaining([true, "org_a", 2]));
});
it("records explicit personal scope and still prevents claiming another person's server", async () => {
  state.rows = [[server({ organizationId: null })], []];
  await issue();
  expect(
    writes("server_claim_challenges").find((query) => query.sql.startsWith("insert"))?.params,
  ).toContain(true);
  state.queries = [];
  state.rows = [[server({ organizationId: null, ownerId: "other" })]];
  await expect(issue()).rejects.toMatchObject({ statusCode: 409 });
  expect(writes("server_claim_challenges")).toHaveLength(0);
});
it("rechecks organization authority before consuming an otherwise live challenge", async () => {
  state.rows = [[server()], [["other"]], [["user"]], []];
  await expect(consume()).rejects.toMatchObject({ code: "SERVER_CLAIM_AUTHORITY_CHANGED" });
  expect(writes("server_claim_challenges")).toHaveLength(0);
  expect(writes("verification_requests")).toHaveLength(0);
});
it.each([
  { claimScopeRecorded: false },
  { claimOrganizationId: "org_b" },
  { claimOrganizationId: null },
])("cannot consume legacy or transferred proof: %j", async (extra) => {
  state.rows = [[server()], [["manager"]], [proof(extra)]];
  await expect(consume()).rejects.toMatchObject({ code: "SERVER_CLAIM_SCOPE_CHANGED" });
  expect(writes("server_claim_challenges")).toHaveLength(0);
  expect(writes("verification_requests")).toHaveLength(0);
});
it("records both verification and server timeline events only with a consumed proof", async () => {
  state.rows = [
    [server()],
    [["manager"]],
    [proof()],
    [],
    [["scc_11111111-1111-4111-8111-111111111111"]],
    [request({ status: "pending" })],
  ];
  await consume();
  expect(writes("audit_events").map((query) => query.params)).toEqual(
    expect.arrayContaining([
      expect.arrayContaining(["verification.requested", "verification", "ver_a"]),
      expect.arrayContaining(["server.control_proof_recorded", "server", "srv_a"]),
    ]),
  );
});
it("approves an organization proof without transferring it to a personal owner", async () => {
  state.rows = [
    [request()],
    [["legacy_owner", "org_a", 2, false]],
    [["proof", 2, true, "org_a"]],
    [["manager"]],
    [["srv_a"]],
    [["ntf", "manager"]],
  ];
  await approve();
  const sessionLock = state.queries.findIndex(
    (query) => query.sql.includes('from "sessions"') && query.sql.includes("for update"),
  );
  const decision = state.queries.findIndex((query) =>
    query.sql.startsWith('update "verification_requests"'),
  );
  expect(sessionLock).toBeGreaterThanOrEqual(0);
  expect(sessionLock).toBeLessThan(decision);
  const update = writes("servers")[0];
  expect(update.params[0]).toBeNull();
  expect(update.sql).not.toContain('"organization_id" =');
  expect(writes("audit_events")[0].params).toEqual(
    expect.arrayContaining(["server.verification_approved", "moderator", "server", "srv_a"]),
  );
  expect(
    state.queries.findIndex((query) => query.sql.includes('from "organizations"')),
  ).toBeLessThan(state.queries.indexOf(update));
});
it("keeps personal approval assigning the requester", async () => {
  state.rows = [
    [request()],
    [[null, null, 2, false]],
    [["proof", 2, true, null]],
    [["srv_a"]],
    [["ntf", "manager"]],
  ];
  await approve();
  expect(writes("servers")[0].params[0]).toBe("manager");
});
it.each([
  [2, false, "org_a"],
  [2, true, "org_b"],
  [2, true, null],
])(
  "rejects unbound or transferred scope at moderation: %s %s %s",
  async (revision, recorded, organization) => {
    state.rows = [
      [request()],
      [[null, "org_a", 2, false]],
      [["proof", revision, recorded, organization]],
    ];
    await expect(approve()).rejects.toMatchObject({ code: "SERVER_CLAIM_SCOPE_CHANGED" });
    expect(writes("servers")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
  },
);
it("fails approval after a delegation was revoked and emits no success effects", async () => {
  state.rows = [
    [request()],
    [[null, "org_a", 2, false]],
    [["proof", 2, true, "org_a"]],
    [["other"]],
    [["user"]],
    [],
  ];
  await expect(approve()).rejects.toMatchObject({
    statusCode: 409,
    code: "SERVER_CLAIM_AUTHORITY_CHANGED",
  });
  expect(writes("servers")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
});
it.each([
  { serverRows: [] },
  { serverRows: [["other", null, 2, false]] },
  { serverRows: [[null, null, 2, true]] },
])("rejects missing, foreign-owned or already verified servers", async ({ serverRows }) => {
  state.rows = [[request()], serverRows];
  await expect(approve()).rejects.toMatchObject({ statusCode: 409 });
  expect(writes("servers")).toHaveLength(0);
});
it("lets moderators close a stale request without requiring the former requester's authority", async () => {
  state.rows = [[request({ status: "rejected" })], [["ntf", "manager"]]];
  await verificationRepository.resolveRequest({
    currentToken: "tok_moderator",
    id: "ver_a",
    reviewerId: "moderator",
    decision: "rejected",
  });
  expect(state.queries.some((query) => query.sql.includes('from "servers"'))).toBe(false);
  expect(writes("servers")).toHaveLength(0);
  expect(writes("audit_events")[0].params).toContain("server.verification_rejected");
});
it("has no duplicate timeline or inbox effects for an already resolved request", async () => {
  state.rows = [[]];
  expect(await approve()).toBeNull();
  expect(writes("audit_events")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
