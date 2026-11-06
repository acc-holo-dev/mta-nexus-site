import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationWorkspaceQueryDbMock } = await import(
    "./helpers/organization-workspace-query-harness"
  );
  return createOrganizationWorkspaceQueryDbMock();
});
vi.mock("../packages/db/src/repositories/initiating-session", async (original) => {
  const actual =
    await original<typeof import("../packages/db/src/repositories/initiating-session")>();
  return {
    lockInitiatingSession: (
      tx: Parameters<typeof actual.lockInitiatingSession>[0],
      actor: string,
      token: string,
    ) =>
      token === "unit-token" ? Promise.resolve() : actual.lockInitiatingSession(tx, actor, token),
  };
});
vi.mock("../packages/db/src/repositories/organization-access-notice", () => ({
  storeOrganizationAccessNotice: vi.fn(),
}));

import { organizationWorkspaceRepository as repository } from "../packages/db/src/repositories/organization-workspace";
import {
  installOrganizationWorkspaceQueryHooks,
  organizationWorkspaceQueryOrgRow as orgRow,
  organizationWorkspaceQueryState as state,
} from "./helpers/organization-workspace-query-harness";

installOrganizationWorkspaceQueryHooks();

it("bounds own organization pages and uses SQL membership scope and stable ordering", async () => {
  await repository.pageMine("actor", 2, "%_");
  const query = state.queries[0];
  expect(query.sql).toContain("exists (select");
  expect(query.sql).toContain('"organizations"."owner_id" =');
  expect(query.sql).toContain(
    'order by "organizations"."updated_at" desc, "organizations"."id" desc',
  );
  expect(query.params).toContain("%\\%\\_%");
  expect(query.params.slice(-2)).toEqual([21, 20]);
});

it("reads workspace identity and filtered team in one private snapshot", async () => {
  state.rows = [[orgRow()], [["owner", "owner", "Owner", null]], []];
  const result = await repository.getWorkspace("org", "owner", 2, "%_");
  expect(result.role).toBe("owner");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const query = state.queries[state.queries.length - 1];
  expect(query.sql).toContain('"organization_members"."organization_id" =');
  expect(query.sql).toContain(
    'order by "organization_members"."created_at" asc, "organization_members"."id" asc',
  );
  expect(query.params.slice(-2)).toEqual([21, 20]);
  expect(query.sql.split(" from ")[0]).not.toMatch(/email|password|manage_products/u);
});

it("denies nonmembers and forged legacy owner memberships", async () => {
  state.rows = [[orgRow()], [["owner"]]];
  await expect(repository.getWorkspace("org", "outsider")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
});
