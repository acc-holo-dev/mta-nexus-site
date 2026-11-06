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
  organizationBatchQueryAudits as audits,
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

it("writes only changed members once, retains commercial grants, bumps one version and emits existing per-member events", async () => {
  const reviewed = await preview();
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  const result = await repository.batchMembers(
    "org",
    "owner",
    { ...input, previewRevision: reviewed.previewRevision },
    audits,
    "unit-token",
  );
  expect(result.changedUserIds).toEqual(["a"]);
  expect(result.organization.updatedAt.toISOString()).toBe(later);
  const changes = writes();
  expect(
    changes.filter((query) => query.sql.startsWith('update "organization_members"')),
  ).toHaveLength(1);
  expect(changes[0].params).toContain(JSON.stringify(["manage_resources", "manage_servers"]));
  expect(changes.filter((query) => query.sql.startsWith('update "organizations"'))).toHaveLength(1);
  expect(
    changes.find((query) => query.sql.startsWith('insert into "audit_events"'))?.params,
  ).toContain("audit-a");
  expect(state.notice).toHaveBeenCalledTimes(1);
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "org" }),
    "a",
    "updated",
    "audit-a",
  );
});

it("rejects stale review, current permission changes and changed action before all writes", async () => {
  const reviewed = await preview();
  for (const changed of [
    { ...input, previewRevision: "f".repeat(64) },
    { ...input, previewRevision: reviewed.previewRevision, change: { action: "remove" } as const },
  ]) {
    state.queries = [];
    state.rows = [[org()], members];
    await expect(
      repository.batchMembers("org", "owner", changed, audits, "unit-token"),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(writes()).toEqual([]);
  }
  state.queries = [];
  state.rows = [
    [org()],
    members.map((row, i) =>
      i === 0 ? [row[0], row[1], row[2], ["different_commercial_grant"], row[4], row[5]] : row,
    ),
  ];
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
      "unit-token",
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(writes()).toEqual([]);
});

it("preserves role when changing only delegated access and deletes a reviewed group in one command", async () => {
  const change = { action: "server_access", enabled: false } as const;
  state.rows = [[org()], members];
  const reviewed = await repository.previewMembers(
    "org",
    "owner",
    { ...input, change },
    "unit-token",
  );
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  await repository.batchMembers(
    "org",
    "owner",
    { ...input, change, previewRevision: reviewed.previewRevision },
    audits,
    "unit-token",
  );
  expect(writes()[0].params).toContain("member");
  expect(writes()[0].params).toContain(JSON.stringify(["manage_resources"]));
  const remove = { action: "remove" } as const;
  state.rows = [[org()], members];
  const removal = await repository.previewMembers(
    "org",
    "owner",
    { ...input, change: remove },
    "unit-token",
  );
  state.queries = [];
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  const result = await repository.batchMembers(
    "org",
    "owner",
    { ...input, change: remove, previewRevision: removal.previewRevision },
    audits,
    "unit-token",
  );
  expect(result.changedUserIds).toEqual(["a", "b"]);
  expect(writes().filter((query) => query.sql.startsWith("delete"))).toHaveLength(1);
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    "b",
    "removed",
    "audit-b",
  );
});

it("propagates mandatory audit and inbox failures to the enclosing transaction", async () => {
  const reviewed = await preview();
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  state.fail = "audit_events";
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
      "unit-token",
    ),
  ).rejects.toThrow();
  expect(state.notice).not.toHaveBeenCalled();
  state.fail = "";
  state.rows = [[org()], members, [org({ updatedAt: later })]];
  state.notice.mockRejectedValue(new Error("Inbox unavailable"));
  await expect(
    repository.batchMembers(
      "org",
      "owner",
      { ...input, previewRevision: reviewed.previewRevision },
      audits,
      "unit-token",
    ),
  ).rejects.toThrow("Inbox unavailable");
});
