import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerClaimLifecycleQueryDbMock } = await import(
    "./helpers/server-claim-lifecycle-query-harness"
  );
  return createServerClaimLifecycleQueryDbMock();
});

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createServerClaimLifecycleQueryWebPushMock } = await import(
    "./helpers/server-claim-lifecycle-query-harness"
  );
  return createServerClaimLifecycleQueryWebPushMock();
});

import { VerificationRepository } from "../packages/db/src/repositories/verification";
import {
  installServerClaimLifecycleQueryHooks,
  serverClaimLifecycleQueryRequest as request,
  serverClaimLifecycleQueryState as state,
  serverClaimLifecycleQueryWrites as writes,
} from "./helpers/server-claim-lifecycle-query-harness";

const verificationRepository = new VerificationRepository();
const approve = () =>
  verificationRepository.resolveRequest({
    currentToken: "tok_moderator",
    id: "ver_a",
    reviewerId: "moderator",
    decision: "approved",
  });

installServerClaimLifecycleQueryHooks();

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
