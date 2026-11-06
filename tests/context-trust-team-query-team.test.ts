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

import { organizationTeamDirectoryRepository as team } from "../packages/db/src/repositories/organization-team-directory";
import {
  contextTrustTeamQueryAccess as access,
  contextTrustTeamQueryState as state,
  contextTrustTeamQueryTime as time,
  installContextTrustTeamQueryHooks,
} from "./helpers/context-trust-team-query-harness";

installContextTrustTeamQueryHooks();

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
