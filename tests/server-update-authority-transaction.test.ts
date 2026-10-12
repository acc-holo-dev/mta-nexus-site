import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  server: {
    id: "srv_1",
    ownerId: "usr_owner",
    organizationId: null as string | null,
    updatedAt: new Date("2026-10-10T01:00:00.000Z"),
  } as null | {
    id: string;
    ownerId: string | null;
    organizationId: string | null;
    updatedAt: Date;
  },
  organization: { ownerId: "usr_org_owner" } as null | { ownerId: string },
  membership: null as null | { role: string; permissions: string[] },
  currentRole: "user" as string | null,
  selection: 0,
  locks: [] as string[],
  updated: [] as Record<string, unknown>[],
  audited: [] as Record<string, unknown>[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => {
          const chain = {
            from: () => chain,
            where: () => chain,
            orderBy: () => chain,
            for: (lock: string) => {
              state.locks.push(lock);
              const index = state.selection++;
              const item =
                index === 0
                  ? state.server
                  : index === 1
                    ? state.currentRole
                      ? { role: state.currentRole }
                      : null
                    : index === 2
                      ? state.organization
                        ? { id: "org_1", ...state.organization }
                        : null
                      : state.membership
                        ? { organizationId: "org_1", ...state.membership }
                        : null;
              const result = Promise.resolve(item ? [item] : []);
              return Object.assign(result, { limit: () => result });
            },
          };
          return chain;
        },
        update: () => ({
          set: (value: Record<string, unknown>) => ({
            where: () => ({
              returning: async () => {
                state.updated.push(value);
                return [{ ...state.server, ...value }];
              },
            }),
          }),
        }),
        insert: () => ({
          values: async (value: Record<string, unknown>) => {
            state.audited.push(value);
          },
        }),
      };
      return work(tx);
    },
  },
}));

import { ServerRepository } from "../packages/db/src/repositories/servers";

const repository = new ServerRepository();
const audit = (id: string) => ({
  id: "aud_1",
  actorId: id,
  actorType: "user" as const,
  action: "server.updated",
  targetId: "srv_1",
  targetType: "server",
  details: { fields: ["description"] },
});
const actor = (id: string, role = "user") => ({ id, role: role as "user" | "admin" });

beforeEach(() => {
  state.server = {
    id: "srv_1",
    ownerId: "usr_owner",
    organizationId: null,
    updatedAt: new Date("2026-10-10T01:00:00.000Z"),
  };
  state.organization = { ownerId: "usr_org_owner" };
  state.membership = null;
  state.currentRole = "user";
  state.selection = 0;
  state.locks = [];
  state.updated = [];
  state.audited = [];
});

describe("owner updates revalidate authority inside the write transaction", () => {
  it("allows a personal owner and retains an audited write", async () => {
    const result = await repository.updateManagedWithAudit(
      "srv_1",
      { description: "New" },
      audit("usr_owner"),
      actor("usr_owner"),
      new Date("2026-10-10T01:00:00.000Z"),
    );
    expect(result).toMatchObject({ description: "New" });
    expect(state.locks).toEqual(["update", "share"]);
    expect(state.updated).toHaveLength(1);
    expect(state.audited).toHaveLength(1);
  });

  it("rejects an unrelated user without updating or auditing", async () => {
    await expect(
      repository.updateManagedWithAudit(
        "srv_1",
        { description: "Unauthorized" },
        audit("usr_other"),
        actor("usr_other"),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(state.updated).toHaveLength(0);
    expect(state.audited).toHaveLength(0);
  });

  it("honors the current locked administrator role", async () => {
    state.currentRole = "admin";
    await repository.updateManagedWithAudit(
      "srv_1",
      { description: "Admin edit" },
      audit("usr_admin"),
      actor("usr_admin", "admin"),
    );
    expect(state.locks).toEqual(["update", "share"]);
    expect(state.audited).toHaveLength(1);
  });

  it("locks the organization owner record for an organizational server", async () => {
    if (!state.server) throw new Error("Missing fixture");
    state.server.organizationId = "org_1";
    await repository.updateManagedWithAudit(
      "srv_1",
      { description: "Owner" },
      audit("usr_org_owner"),
      actor("usr_org_owner"),
    );
    expect(state.locks).toEqual(["update", "share", "share"]);
    expect(state.updated).toHaveLength(1);
  });

  it.each([
    { role: "admin", permissions: [] },
    { role: "member", permissions: ["manage_servers"] },
  ])("allows locked delegate permissions: %j", async (membership) => {
    if (!state.server) throw new Error("Missing fixture");
    state.server.organizationId = "org_1";
    state.membership = membership;
    await repository.updateManagedWithAudit(
      "srv_1",
      { description: "Delegated" },
      audit("usr_manager"),
      actor("usr_manager"),
    );
    expect(state.locks).toEqual(["update", "share", "share", "share"]);
    expect(state.audited).toHaveLength(1);
  });

  it.each([
    null,
    { role: "member", permissions: [] },
    { role: "owner", permissions: ["manage_servers"] },
  ])("rejects revoked or missing delegated authority: %j", async (membership) => {
    if (!state.server) throw new Error("Missing fixture");
    state.server.organizationId = "org_1";
    state.membership = membership;
    await expect(
      repository.updateManagedWithAudit(
        "srv_1",
        { description: "Revoked" },
        audit("usr_manager"),
        actor("usr_manager"),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(state.updated).toHaveLength(0);
    expect(state.audited).toHaveLength(0);
  });

  it("rejects stale version tokens without writing an audit event", async () => {
    await expect(
      repository.updateManagedWithAudit(
        "srv_1",
        { description: "Overwritten" },
        audit("usr_owner"),
        actor("usr_owner"),
        new Date("2026-10-09T00:00:00.000Z"),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SERVER_METADATA_CONFLICT",
    });
    expect(state.updated).toHaveLength(0);
    expect(state.audited).toHaveLength(0);
  });

  it("never mutates an absent server", async () => {
    state.server = null;
    await expect(
      repository.updateManagedWithAudit(
        "srv_1",
        { description: "Missing" },
        audit("usr_owner"),
        actor("usr_owner"),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(state.updated).toHaveLength(0);
  });

  it("does not treat an orphaned organization as personal ownership", async () => {
    if (!state.server) throw new Error("Missing fixture");
    state.server.organizationId = "org_1";
    state.organization = null;
    await expect(
      repository.updateManagedWithAudit(
        "srv_1",
        { description: "Orphan" },
        audit("usr_owner"),
        actor("usr_owner"),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(state.updated).toHaveLength(0);
  });
});

it("refuses a revoked platform administrator even when a stale session claims admin", async () => {
  await expect(
    repository.updateManagedWithAudit(
      "srv_1",
      { description: "Old admin" },
      audit("former_admin"),
      actor("former_admin", "admin"),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.updated).toHaveLength(0);
  expect(state.audited).toHaveLength(0);
});
it("requires a retained current account under a shared lock", async () => {
  state.currentRole = null;
  await expect(
    repository.updateManagedWithAudit(
      "srv_1",
      { description: "Old owner" },
      audit("usr_owner"),
      actor("usr_owner"),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.updated).toHaveLength(0);
});
