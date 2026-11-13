import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  organization: { ownerId: "usr_owner" } as { ownerId: string } | null,
  membership: null as { role: string; permissions: string[] } | null,
  actorId: "usr_owner",
  actorRole: "user",
  locks: [] as string[],
  inserted: [] as Record<string, unknown>[],
}));

vi.mock("../../site/packages/db/src/repositories/initiating-session", () => ({
  lockInitiatingSession: vi.fn(async () => {}),
}));

vi.mock("../../site/packages/db/src/client", () => ({
  db: {
    transaction: async (handler: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: (fields: Record<string, unknown>) => ({
          from: () => ({
            where: () => ({
              for: (mode: string) => {
                state.locks.push(mode);
                return {
                  limit: async () => {
                    const row =
                      "ownerId" in fields
                        ? state.organization
                        : "permissions" in fields
                          ? state.membership
                          : { id: state.actorId, role: state.actorRole };
                    return row ? [row] : [];
                  },
                };
              },
            }),
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            state.inserted.push(values);
            return state.inserted.length === 1
              ? { returning: async () => [values] }
              : Promise.resolve();
          },
        }),
      };
      return handler(tx);
    },
  },
}));

import { ServerRepository } from "../../site/packages/db/src/repositories/servers";

const server = (organizationId: string | undefined = "org_1") => ({
  id: "srv_1",
  name: "Nexus MTA",
  slug: "nexus-mta",
  ipAddress: "203.0.113.22",
  port: 22003,
  status: "active" as const,
  visibility: "private" as const,
  isVerified: false,
  mediaUrls: [] as string[],
  gameplayTags: [] as string[],
  ...(organizationId ? { organizationId } : {}),
});
const audit = (actorId: string) => {
  state.actorId = actorId;
  return {
    id: "aud_1",
    actorId,
    actorType: "user" as const,
    action: "server.created",
    targetId: "srv_1",
    targetType: "server",
    details: { fields: ["name"] },
  };
};

beforeEach(() => {
  state.organization = { ownerId: "usr_owner" };
  state.membership = null;
  state.actorId = "usr_owner";
  state.actorRole = "user";
  state.locks = [];
  state.inserted = [];
});

describe("atomic server create authority", () => {
  const repository = new ServerRepository();

  it("keeps direct organization ownership locked through both inserts", async () => {
    await expect(
      repository.createWithAudit(server(), audit("usr_owner"), "session"),
    ).resolves.toMatchObject({
      id: "srv_1",
    });
    expect(state.locks).toEqual(["share", "share"]);
    expect(state.inserted).toHaveLength(2);
  });

  it.each([
    { role: "admin", permissions: [] },
    { role: "member", permissions: ["manage_servers"] },
  ])("accepts delegated rights under locked membership: %j", async (membership) => {
    state.membership = membership;
    await expect(
      repository.createWithAudit(server(), audit("usr_manager"), "session"),
    ).resolves.toMatchObject({ id: "srv_1" });
    expect(state.locks).toEqual(["share", "share", "share"]);
    expect(state.inserted).toHaveLength(2);
  });

  it.each([
    null,
    { role: "owner", permissions: ["manage_servers"] },
    { role: "member", permissions: [] },
    { role: "developer", permissions: ["view_servers"] },
  ])("rejects absent or revoked membership before any inserts: %j", async (membership) => {
    state.membership = membership;
    await expect(
      repository.createWithAudit(server(), audit("usr_manager"), "session"),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
    expect(state.locks).toEqual(["share", "share", "share"]);
    expect(state.inserted).toHaveLength(0);
  });

  it("allows a platform administrator to create a server in an existing organization", async () => {
    state.actorRole = "admin";
    await expect(
      repository.createWithAudit(server(), audit("usr_admin"), "session"),
    ).resolves.toMatchObject({ id: "srv_1" });
    expect(state.locks).toEqual(["share", "share"]);
    expect(state.inserted).toHaveLength(2);
  });

  it("rejects nonexistent organizations and does not persist an audit", async () => {
    state.organization = null;
    await expect(
      repository.createWithAudit(server(), audit("usr_manager"), "session"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(state.inserted).toHaveLength(0);
  });

  it("keeps personal registrations independent from organization lookups", async () => {
    await expect(
      repository.createWithAudit(
        { ...server(), organizationId: undefined, ownerId: "usr_owner" },
        audit("usr_owner"),
        "session",
      ),
    ).resolves.toMatchObject({ id: "srv_1" });
    expect(state.locks).toEqual(["share"]);
    expect(state.inserted).toHaveLength(2);
  });
});
