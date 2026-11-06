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

import { db } from "../packages/db/src/client";
import { assertOrganizationServerClaimAuthority } from "../packages/db/src/repositories/server-claim-authority";
import { ServerClaimChallengeRepository } from "../packages/db/src/repositories/server-claim-challenges";
import {
  installServerClaimLifecycleQueryHooks,
  serverClaimLifecycleQueryProof as proof,
  serverClaimLifecycleQueryRequest as request,
  serverClaimLifecycleQueryServer as server,
  serverClaimLifecycleQueryState as state,
  serverClaimLifecycleQueryWrites as writes,
} from "./helpers/server-claim-lifecycle-query-harness";

const challengeRepository = new ServerClaimChallengeRepository();
const issue = () =>
  challengeRepository.issue({
    serverId: "srv_a",
    requesterId: "manager",
    auditId: "aud_issue",
    currentToken: "tok_manager",
  });
const consume = () =>
  challengeRepository.consumeVerifiedProof({
    id: "scc_11111111-1111-4111-8111-111111111111",
    serverId: "srv_a",
    requesterId: "manager",
    currentToken: "tok_manager",
    token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
    sourceFetchedAt: new Date(state.now),
    expectedEndpoint: { ipAddress: "198.51.100.8", port: 22003 },
    verificationRequestId: "ver_a",
    auditId: "aud_proof",
  });

installServerClaimLifecycleQueryHooks();

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
