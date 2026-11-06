import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createContextTrustTeamQueryDbMock } = await import(
    "./helpers/context-trust-team-query-harness"
  );
  return createContextTrustTeamQueryDbMock();
});
vi.mock("../packages/db/src/repositories/organization-access-notice", () => ({
  storeOrganizationAccessNotice: vi.fn(),
}));

import { publicContextTrustRepository as trust } from "../packages/db/src/repositories/public-context-trust";
import {
  contextTrustTeamQueryContext as context,
  contextTrustTeamQueryState as state,
  contextTrustTeamQueryTime as time,
  installContextTrustTeamQueryHooks,
} from "./helpers/context-trust-team-query-harness";

installContextTrustTeamQueryHooks();

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
