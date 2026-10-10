import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Server, User } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  organization: vi.fn(),
  member: vi.fn(),
  legacyAllMemberships: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  serverRepository: {},
  organizationRepository: {
    findById: mocks.organization,
    findServerMembershipForUser: mocks.member,
    listUserMemberships: mocks.legacyAllMemberships,
  },
}));
vi.mock("@nexus/security", async () => {
  // Exercise the real security policy, not a permissive mock of can().
  const { can } = await import("../packages/security/src/policy");
  return { can, generateId: vi.fn((prefix: string) => `${prefix}_test`) };
});

import { serverService } from "../apps/web/src/lib/services/server-service";

const actor = (id: string, role: User["role"] = "user") => ({
  id, role,
}) as User;
const server = (
  organizationId?: string,
  ownerId?: string,
) => ({ id: "srv_1", organizationId, ownerId }) as Server;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organization.mockResolvedValue({
    id: "org_1", ownerId: "usr_owner",
  });
  mocks.member.mockResolvedValue(null);
});

describe("server management access is scoped to one live organization", () => {
  it("permits personal ownership without loading any organization memberships", async () => {
    expect(await serverService.canManageServer(
      server(undefined, "usr_owner"), actor("usr_owner"),
    )).toBe(true);
    expect(await serverService.canManageServer(
      server(undefined, "usr_owner"), actor("usr_stranger"),
    )).toBe(false);
    expect(mocks.organization).not.toHaveBeenCalled();
    expect(mocks.member).not.toHaveBeenCalled();
    expect(mocks.legacyAllMemberships).not.toHaveBeenCalled();
  });

  it("denies an orphaned organization listing even with stale manage_servers rights", async () => {
    mocks.organization.mockResolvedValue(null);
    mocks.member.mockResolvedValue({
      organizationId: "org_1", role: "member", permissions: ["manage_servers"],
    });
    expect(await serverService.canManageServer(
      server("org_1", "usr_manager"), actor("usr_manager"),
    )).toBe(false);
    expect(mocks.member).not.toHaveBeenCalled();
  });

  it("permits the current organization owner without loading membership records", async () => {
    expect(await serverService.canManageServer(
      server("org_1"), actor("usr_owner"),
    )).toBe(true);
    expect(mocks.organization).toHaveBeenCalledWith("org_1");
    expect(mocks.member).not.toHaveBeenCalled();
  });

  it.each([
    { role: "admin", permissions: [] },
    { role: "owner", permissions: [] },
    { role: "member", permissions: ["manage_servers"] },
  ])("allows one scoped delegated membership: %j", async ({ role, permissions }) => {
    mocks.member.mockResolvedValue({
      organizationId: "org_1", role, permissions,
    });
    expect(await serverService.canManageServer(
      server("org_1", "usr_legacy"), actor("usr_manager"),
    )).toBe(true);
    expect(mocks.member).toHaveBeenCalledExactlyOnceWith("org_1", "usr_manager");
    expect(mocks.legacyAllMemberships).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { organizationId: "org_1", role: "member", permissions: [] },
    { organizationId: "org_1", role: "member", permissions: ["manage_products"] },
    { organizationId: "org_other", role: "admin", permissions: [] },
  ])("rejects wrong or revoked scoped memberships: %j", async (membership) => {
    mocks.member.mockResolvedValue(membership);
    expect(await serverService.canManageServer(
      server("org_1", "usr_legacy"), actor("usr_manager"),
    )).toBe(false);
    expect(mocks.member).toHaveBeenCalledExactlyOnceWith("org_1", "usr_manager");
  });

  it("preserves the platform administrator override without a DB lookup", async () => {
    expect(await serverService.canManageServer(
      server("org_1"), actor("usr_admin", "admin"),
    )).toBe(true);
    expect(mocks.organization).not.toHaveBeenCalled();
    expect(mocks.member).not.toHaveBeenCalled();
  });
});
