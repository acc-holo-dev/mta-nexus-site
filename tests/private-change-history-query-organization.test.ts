import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createPrivateChangeHistoryQueryDbMock } = await import(
    "./helpers/private-change-history-query-harness"
  );
  return createPrivateChangeHistoryQueryDbMock();
});

import { organizationGovernanceRepository as team } from "../packages/db/src/repositories/organization-governance";
import {
  installPrivateChangeHistoryQueryHooks,
  privateChangeHistoryQueryBase as base,
  privateChangeHistoryQueryFingerprint as fingerprint,
  privateChangeHistoryQueryOrg as org,
  privateChangeHistoryQueryStamp as stamp,
  privateChangeHistoryQueryState as state,
} from "./helpers/private-change-history-query-harness";

installPrivateChangeHistoryQueryHooks();

it("filters organization membership by current public accounts using escaped search before the page limit", async () => {
  state.rows = [[org()], [[stamp]], []];
  const filters = { ...base, group: "team" as const, period: "30" as const, query: "%_" };
  await team.history("org", "owner", undefined, filters);
  const query = state.queries[2];
  expect(query.params).toEqual(
    expect.arrayContaining([
      "organization",
      "org",
      "organization.member_updated",
      30,
      "%\\%\\_%",
      21,
    ]),
  );
  expect(query.params).not.toContain("organization.ownership_transferred");
  expect(query.sql).toContain('"organization_activity_subject"."username" ilike');
  expect(query.sql).not.toMatch(/email|password|ip_address|user_agent/u);
});
it("binds organization pages to manager, target, group, search and exact window", async () => {
  const filters = {
    ...base,
    group: "ownership" as const,
    query: "Owner",
    cursor: {
      version: 1 as const,
      context: fingerprint(
        "organization-change-history",
        "owner",
        "org",
        "all",
        "ownership",
        "Owner",
      ),
      until: stamp,
      id: "anchor",
    },
  };
  state.rows = [[org()], [[stamp]], [["anchor", stamp]], []];
  expect((await team.history("org", "owner", undefined, filters)).until).toBe(stamp);
  expect(state.queries[2].params).toContain("organization.ownership_transferred");
  expect(state.queries[2].params).toContain("%Owner%");
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  await expect(team.history("other", "owner", undefined, filters)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
});
it("rechecks live membership before reading the clock or audit rows", async () => {
  state.rows = [[org()], [["member"]]];
  await expect(team.history("org", "foreign", undefined, base)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries.some((query) => query.sql.includes('from "audit_events"'))).toBe(false);
});
