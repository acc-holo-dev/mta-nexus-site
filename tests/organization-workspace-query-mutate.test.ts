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
  organizationWorkspaceQueryAudit as audit,
  organizationWorkspaceQueryFields as fields,
  organizationWorkspaceQueryMemberRow as memberRow,
  organizationWorkspaceQueryOrgRow as orgRow,
  organizationWorkspaceQueryState as state,
  organizationWorkspaceQueryVersion as version,
} from "./helpers/organization-workspace-query-harness";

installOrganizationWorkspaceQueryHooks();

it("locks profile authority and rejects stale revisions before update/audit", async () => {
  state.rows = [[orgRow()]];
  await expect(
    repository.updateProfile(
      "org",
      "owner",
      new Date(version.getTime() - 1),
      fields,
      audit,
      "unit-token",
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries).toHaveLength(1);
});

it("holds the current administrator grant and saves only public profile fields", async () => {
  state.rows = [[orgRow()], [["admin"]], [["admin"]], [orgRow({ name: fields.name })], []];
  await repository.updateProfile(
    "org",
    "admin",
    version,
    fields,
    { ...audit, actorId: "admin" },
    "unit-token",
  );
  expect(state.queries[1].sql).toContain("for share");
  const update = state.queries[3].sql;
  expect(update).toContain('"name" =');
  expect(update).toContain("interval '1 millisecond'");
  expect(update).not.toMatch(/"owner_id" =|"slug" =|"is_verified" =/u);
  expect(state.queries[4].sql).toContain('insert into "audit_events"');
});

it("denies developer profile writes after reading live role", async () => {
  state.rows = [[orgRow()], [["developer"]]];
  await expect(
    repository.updateProfile("org", "developer", version, fields, audit, "unit-token"),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries).toHaveLength(2);
});

it("protects owner removal regardless of membership records", async () => {
  state.rows = [[orgRow()], []];
  await expect(
    repository.changeMember("org", "owner", version, "owner", null, audit, "unit-token"),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries.some((q) => q.sql.startsWith("delete"))).toBe(false);
});

it("prevents administrators from promoting peers or removing administrators", async () => {
  state.rows = [[orgRow()], [["admin"]], [memberRow({ role: "admin" })]];
  await expect(
    repository.changeMember("org", "administrator", version, "target", null, audit, "unit-token"),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries).toHaveLength(3);
});

it("retains commercial/custom permissions during a server permission change", async () => {
  state.rows = [
    [orgRow()],
    [memberRow()],
    [["owner"]],
    [],
    [orgRow({ updatedAt: new Date(version.getTime() + 1).toISOString() })],
    [],
  ];
  const result = await repository.changeMember(
    "org",
    "owner",
    version,
    "target",
    { role: "member", managesServers: false },
    audit,
    "unit-token",
  );
  expect(result).toMatchObject({ userId: "target", role: "member", managesServers: false });
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[3].params).toContain(JSON.stringify(["manage_products", "custom"]));
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});

it("rejects duplicate member creation without revision/audit writes", async () => {
  state.rows = [[orgRow()], [["target", "target", "Target", null]], [["owner"]], []];
  await expect(
    repository.addMember(
      "org",
      "owner",
      version,
      "target",
      "member",
      false,
      "mem",
      audit,
      "unit-token",
    ),
  ).rejects.toMatchObject({ code: "MEMBER_EXISTS" });
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[3].sql).toContain("on conflict");
  expect(state.queries).toHaveLength(4);
});

it("does not look up an account before rejecting an unauthorized administrator grant", async () => {
  state.rows = [[orgRow()], [["admin"]]];
  await expect(
    repository.addMember(
      "org",
      "admin",
      version,
      "target",
      "admin",
      false,
      "mem",
      audit,
      "unit-token",
    ),
  ).rejects.toMatchObject({ code: "MEMBER_PROTECTED" });
  expect(state.queries).toHaveLength(2);
});

it("creates the owner membership and audit with an unverified profile in one transaction", async () => {
  state.rows = [
    [["owner"]],
    [["session", new Date(Date.now() + 3600000).toISOString()]],
    [orgRow()],
    [],
    [],
    [["session", new Date(Date.now() + 3600000).toISOString()]],
  ];
  await repository.create(
    "org",
    "owner",
    "team",
    { name: "Team", description: "", logoUrl: "", websiteUrl: "" },
    audit,
    "test-token",
  );
  const inserts = state.queries.filter((q) => q.sql.startsWith("insert into"));
  expect(inserts.map((q) => q.sql.match(/insert into "([^"]+)"/u)?.[1])).toEqual([
    "organizations",
    "organization_members",
    "audit_events",
  ]);
  expect(inserts[0].params).toContain(false);
  expect(inserts[1].params).toContain("owner");
});

it("lets a regular member revoke only their own membership under the organization lock", async () => {
  state.rows = [
    [orgRow()],
    [["member"]],
    [["actor"]],
    [["actor"]],
    [orgRow({ updatedAt: new Date(version.getTime() + 1).toISOString() })],
    [],
  ];
  const result = await repository.leave(
    "org",
    "actor",
    version,
    { ...audit, actorId: "actor" },
    "unit-token",
  );
  expect(result).toMatchObject({ userId: "actor", removed: true });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[3].params).toEqual(["org", "actor"]);
  expect(state.queries[3].sql).toContain('delete from "organization_members"');
});

it("prevents the owner from leaving and rejects stale voluntary exits", async () => {
  state.rows = [[orgRow()]];
  await expect(
    repository.leave("org", "owner", version, audit, "unit-token"),
  ).rejects.toMatchObject({
    code: "MEMBER_PROTECTED",
  });
  state.queries = [];
  state.rows = [[orgRow()], [["developer"]]];
  await expect(
    repository.leave("org", "actor", new Date(version.getTime() - 1), audit, "unit-token"),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(2);
});
