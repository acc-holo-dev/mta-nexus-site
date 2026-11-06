import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", () => ({
  lockInitiatingSession: async () => {},
}));
vi.mock("../packages/db/src/repositories/organization-access-notice", async () => {
  const { organizationBatchQueryState } = await import("./helpers/organization-batch-query-harness");
  return { storeOrganizationAccessNotice: organizationBatchQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationBatchQueryDbMock } = await import(
    "./helpers/organization-batch-query-harness"
  );
  return createOrganizationBatchQueryDbMock();
});

import { organizationWorkspaceRepository as repository } from "../packages/db/src/repositories/organization-workspace";
import {
  installOrganizationBatchQueryHooks,
  organizationBatchQueryInput as input,
  organizationBatchQueryLater as later,
  organizationBatchQueryMembers as members,
  organizationBatchQueryOrg as org,
  organizationBatchQueryState as state,
  organizationBatchQueryWrites as writes,
} from "./helpers/organization-batch-query-harness";

installOrganizationBatchQueryHooks();

async function preview(extra = {}, rows = members) {
  state.rows = [[org(extra)], rows];
  return repository.previewMembers("org", "owner", input, "unit-token");
}

it("reviews current scoped identities without leaking permission grants and binds unordered selections", async () => {
  const result = await preview();
  expect(result.changedCount).toBe(1);
  expect(result.members.map((member) => member.userId)).toEqual(["a", "b"]);
  expect(result.members[0]).toMatchObject({
    before: { role: "member", managesServers: true },
    after: { role: "developer", managesServers: true },
    changed: true,
  });
  expect(JSON.stringify(result)).not.toMatch(/manage_resources|commercial_custom|permissions|m-a/u);
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain('for share of "organization_members"');
  expect(state.queries[1].sql).toContain('order by "organization_members"."user_id" asc');
  expect(state.queries[1].params).toEqual(expect.arrayContaining(["org", "a", "b"]));
  expect(writes()).toEqual([]);
  state.rows = [[org()], members];
  const reordered = await repository.previewMembers(
    "org",
    "owner",
    {
      ...input,
      userIds: ["a", "b"],
    },
    "unit-token",
  );
  expect(reordered.previewRevision).toBe(result.previewRevision);
});

it.each(["owner", "admin"])(
  "rejects protected %s target and missing members atomically",
  async (role) => {
    state.rows = [
      [org({ ownerId: "actual-owner" })],
      [["admin"]],
      [["m", "a", role, [], "alice", "Alice"], members[1]],
    ];
    await expect(
      repository.previewMembers("org", "owner", input, "unit-token"),
    ).rejects.toMatchObject({
      code: "MEMBER_PROTECTED",
    });
    expect(writes()).toEqual([]);
    state.rows = [[org()], [members[0]]];
    await expect(
      repository.previewMembers("org", "owner", input, "unit-token"),
    ).rejects.toMatchObject({
      code: "MEMBER_NOT_FOUND",
    });
    expect(writes()).toEqual([]);
  },
);

it("denies ordinary members, obsolete organization versions, duplicate and oversized selections", async () => {
  state.rows = [[org({ ownerId: "different" })], [["member"]]];
  await expect(
    repository.previewMembers("org", "owner", input, "unit-token"),
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(2);
  state.rows = [[org({ updatedAt: later })]];
  await expect(
    repository.previewMembers("org", "owner", input, "unit-token"),
  ).rejects.toMatchObject({
    code: "CONFLICT",
  });
  for (const userIds of [["a", "a"], [], Array.from({ length: 21 }, (_, i) => `user-${i}`)])
    await expect(
      repository.previewMembers("org", "owner", { ...input, userIds }, "unit-token"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(writes()).toEqual([]);
});
