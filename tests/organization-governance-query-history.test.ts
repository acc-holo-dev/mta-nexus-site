import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationGovernanceQueryDbMock } = await import(
    "./helpers/organization-governance-query-harness"
  );
  return createOrganizationGovernanceQueryDbMock();
});
vi.mock("../packages/db/src/repositories/initiating-session", async (original) => {
  const { createOrganizationGovernanceQueryInitiatingSessionMock } = await import(
    "./helpers/organization-governance-query-harness"
  );
  return createOrganizationGovernanceQueryInitiatingSessionMock(original);
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createOrganizationGovernanceQueryPushMock } = await import(
    "./helpers/organization-governance-query-harness"
  );
  return createOrganizationGovernanceQueryPushMock();
});

import { organizationGovernanceRepository as repository } from "../packages/db/src/repositories/organization-governance";
import {
  installOrganizationGovernanceQueryHooks,
  organizationGovernanceQueryOrg as org,
  organizationGovernanceQueryState as state,
  organizationGovernanceQueryTime as time,
} from "./helpers/organization-governance-query-harness";

installOrganizationGovernanceQueryHooks();

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
