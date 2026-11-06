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

import { db } from "../packages/db/src/client";
import { storeOrganizationAccessNotice } from "../packages/db/src/repositories/organization-access-notice";
import { organizationGovernanceRepository as repository } from "../packages/db/src/repositories/organization-governance";
import { organizationWorkspaceRepository as workspace } from "../packages/db/src/repositories/organization-workspace";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  organizationGovernanceQueryInput as input,
  installOrganizationGovernanceQueryHooks,
  organizationGovernanceQueryLater as later,
  organizationGovernanceQueryOrg as org,
  organizationGovernanceQueryState as state,
  organizationGovernanceQueryTime as time,
  organizationGovernanceQueryTransferRows as transferRows,
  organizationGovernanceQueryWrites as writes,
} from "./helpers/organization-governance-query-harness";

installOrganizationGovernanceQueryHooks();

it("locks organization, stable memberships and actors, then the owned session before writes", async () => {
  transferRows();
  const result = await repository.transfer(input);
  expect(result).toMatchObject({
    role: "member",
    previousOwnerId: "owner",
    organization: { ownerId: "target" },
    owner: { id: "target" },
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain('order by "organization_members"."user_id" asc');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[2].params).toEqual(["owner", "target"]);
  expect(state.queries[2].sql).toContain('order by "users"."id" asc');
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain('from "sessions"');
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[3].params).toEqual([
    "owner",
    digestSessionToken(input.currentToken),
    expect.any(String),
  ]);
  expect(state.queries[4].sql).toContain('update "organization_members"');
  expect(JSON.stringify(state.queries)).not.toContain(input.currentToken);
  for (const update of writes("organization_members")) {
    expect(update.sql).toContain('set "role" =');
    expect(update.sql).not.toContain("permissions");
  }
  expect(writes("organizations")[0].sql).toContain("interval '1 millisecond'");
  expect(writes("organizations")[0].sql).not.toMatch(/"is_verified" =|"slug" =|"name" =/u);
  expect(writes("audit_events")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(2);
  expect(state.push).toHaveBeenCalledTimes(2);
});
it("repairs a missing legacy owner membership and assigns the explicit retained role", async () => {
  transferRows([["target-membership", "target", "admin"]]);
  const result = await repository.transfer({ ...input, formerOwnerRole: "admin" });
  expect(result.role).toBe("admin");
  const repair = writes("organization_members").find((query) => query.sql.startsWith("insert"));
  expect(repair?.params).toEqual(
    expect.arrayContaining(["new-membership", "org", "owner", "admin", "[]"]),
  );
});
it.each(["admin", "developer", "member", "owner"])(
  "never grants ownership transfer from a nonowner membership %s",
  async (role) => {
    state.rows = [[org()], [[role]]];
    await expect(repository.transfer({ ...input, actorId: "other" })).rejects.toMatchObject({
      code: role === "owner" ? "FORBIDDEN" : "OWNERSHIP_OWNER_REQUIRED",
    });
    expect(writes("organizations")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it.each([
  { expectedUpdatedAt: new Date(later), code: "CONFLICT" },
  { confirmationSlug: "wrong", code: "OWNERSHIP_CONFIRMATION_REQUIRED" },
  { targetId: "owner", code: "OWNERSHIP_TARGET_INVALID" },
])(
  "rejects stale versions, wrong confirmation and self transfer before child writes %j",
  async ({ code, ...extra }) => {
    state.rows = [[org()]];
    await expect(repository.transfer({ ...input, ...extra })).rejects.toMatchObject({ code });
    expect(state.queries).toHaveLength(1);
  },
);
it.each([
  { members: [] },
  { members: [["target-membership", "target", "owner"]] },
  { members: [["target-membership", "target", "legacy"]] },
])("requires a current eligible member %j", async ({ members }) => {
  state.rows = [[org()], members];
  await expect(repository.transfer(input)).rejects.toMatchObject({
    code: "OWNERSHIP_TARGET_INVALID",
  });
  expect(writes("organization_members")).toHaveLength(0);
});
it("rejects a changed username before transfer rather than resolving another account", async () => {
  state.rows = [
    [org()],
    [["membership", "target", "member"]],
    [
      ["owner", "owner", "Owner", null, "owner-password-hash"],
      ["target", "changed", "Target", null, "target-password-hash"],
    ],
  ];
  await expect(repository.transfer(input)).rejects.toMatchObject({
    code: "OWNERSHIP_TARGET_INVALID",
  });
  expect(writes("audit_events")).toHaveLength(0);
});
it("rejects a stale password hash before session lock or ownership writes", async () => {
  transferRows();
  await expect(
    repository.transfer({ ...input, expectedPasswordHash: "rotated-hash" }),
  ).rejects.toMatchObject({ code: "FRESH_AUTH_REQUIRED" });
  expect(state.queries).toHaveLength(3);
  expect(writes("organization_members")).toHaveLength(0);
  expect(writes("organizations")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
});
it("rejects a missing token before querying or an absent current session before any write", async () => {
  await expect(repository.transfer({ ...input, currentToken: "" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.queries).toHaveLength(0);
  transferRows();
  state.rows[3] = [];
  await expect(repository.transfer(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(state.queries).toHaveLength(4);
  expect(writes("organization_members")).toHaveLength(0);
  expect(writes("organizations")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it.each(["audit_events", "notifications"])(
  "does not confirm a transfer when authoritative %s storage fails",
  async (failTable) => {
    transferRows();
    state.failTable = failTable;
    await expect(repository.transfer(input)).rejects.toMatchObject({
      cause: expect.objectContaining({ message: "write failed" }),
    });
  },
);
it("preserves both inbox messages on optional push failure but propagates intent failure", async () => {
  transferRows();
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect((await repository.transfer(input)).organization.ownerId).toBe("target");
  expect(writes("notifications")).toHaveLength(2);
  expect(warn).toHaveBeenCalledTimes(2);
  transferRows();
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(repository.transfer(input)).rejects.toThrow("Admission intent failed");
  warn.mockRestore();
});
it("records access notices in the same transaction for team changes and uses safe revoked-access links", async () => {
  state.rows = [
    [org()],
    [["target", "target", "Target", null]],
    [["owner"]],
    [["membership"]],
    [org({ updatedAt: later })],
  ];
  await workspace.addMember(
    "org",
    "owner",
    new Date(time),
    "target",
    "member",
    false,
    "membership",
    {
      id: "audit",
      actorId: "owner",
      actorType: "user",
      targetType: "organization",
      targetId: "org",
      action: "organization.member_added",
    },
    "unit-token",
  );
  const notice = writes("notifications")[0];
  expect(notice.params).toContain("Organization org: added.");
  expect(notice.params).toContain("/workspace/organizations/org");
  expect(notice.params.join(" ")).not.toContain("permissions");
});
it.each(["removed", "left"] as const)(
  "uses a public organization link and a bounded deterministic notice ID for %s",
  async (change) => {
    const target = "x".repeat(128);
    await db.transaction((tx) =>
      storeOrganizationAccessNotice(
        tx,
        { id: "org", slug: "team" },
        target,
        change,
        "a".repeat(128),
      ),
    );
    const first = writes("notifications")[0];
    expect(first.params).toContain("/organizations/team");
    const id = first.params.find(
      (value) => typeof value === "string" && value.startsWith("ntf_org_access_"),
    ) as string;
    expect(id.length).toBeLessThanOrEqual(128);
    state.queries = [];
    await db.transaction((tx) =>
      storeOrganizationAccessNotice(
        tx,
        { id: "org", slug: "team" },
        target,
        change,
        "a".repeat(128),
      ),
    );
    expect(writes("notifications")[0].params).toContain(id);
  },
);
