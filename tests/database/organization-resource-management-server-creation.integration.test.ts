import { describe, expect, it } from "vitest";
import {
  addOrganizationMember,
  createOrganization,
  createOrgSession,
  createOrgUser,
  fixtureSuffix,
  removeOrganizationMember,
  serverRepository,
  serverService,
  userRepository,
} from "../helpers/organization-resource-management-harness";

describe("organization resource management: server creation", () => {
  it("requires explicit server-management rights for organization server creation", async () => {
    const suffix = fixtureSuffix("server_authz");
    const ownerId = `usr_server_org_owner_${suffix}`;
    const managerId = `usr_server_org_manager_${suffix}`;
    const developerId = `usr_server_org_developer_${suffix}`;
    const organizationId = `org_server_authz_${suffix}`;
    const basePort = 20_000 + ((Date.now() + process.pid) % 30_000);

    for (const [id, label] of [
      [ownerId, "owner"],
      [managerId, "manager"],
      [developerId, "developer"],
    ] as const) {
      await createOrgUser({
        id,
        email: `server_authz_${label}_${suffix}@nexus.test`,
        username: `server_authz_${label}_${suffix}`,
        displayName: `Server Authz ${label}`,
      });
      await createOrgSession(id);
    }

    await createOrganization({
      id: organizationId,
      name: "Server Authorization Organization",
      slug: `server-authorization-org-${suffix}`,
      ownerId,
    });

    await addOrganizationMember({
      id: `om_server_manager_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_servers"],
    });
    await addOrganizationMember({
      id: `om_server_developer_${suffix}`,
      organizationId,
      userId: developerId,
      role: "developer",
      permissions: [],
    });

    const manager = await userRepository.findById(managerId);
    const developer = await userRepository.findById(developerId);
    expect(manager && developer).toBeTruthy();
    if (!manager || !developer) return;

    await expect(
      serverService.createServer(
        {
          name: "Unauthorized Org Developer Server",
          slug: `unauthorized-org-developer-${suffix}`,
          ipAddress: "198.51.100.221",
          port: basePort,
          organizationId,
          visibility: "private",
          gameplayTags: [],
          mediaUrls: [],
        },
        developer,
        undefined,
        `tok_${developerId}`,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });

    const created = await serverService.createServer(
      {
        name: "Delegated Org Server",
        slug: `delegated-org-server-${suffix}`,
        ipAddress: "198.51.100.222",
        port: basePort + 1,
        organizationId,
        visibility: "private",
        gameplayTags: [],
        mediaUrls: [],
      },
      manager,
      undefined,
      `tok_${managerId}`,
    );

    expect(created.organizationId).toBe(organizationId);
    expect(created.ownerId).toBeFalsy();
    expect(await serverService.canManageServer(created, manager)).toBe(true);

    // The owner-picker is only a hint. Authorization is re-read by the
    // same transaction that inserts the server and its audit event.
    await removeOrganizationMember(organizationId, managerId);
    // Display permissions must be revoked alongside the write permissions.
    expect(await serverService.canManageServer(created, manager)).toBe(false);
    await expect(
      serverService.updateServer(
        created.id,
        { description: "Attempted stale-manager edit" },
        manager,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });

    await expect(
      serverService.createServer(
        {
          name: "Revoked Organization Server",
          slug: `revoked-org-server-${suffix}`,
          ipAddress: "198.51.100.223",
          port: basePort + 2,
          organizationId,
          visibility: "private",
          gameplayTags: [],
          mediaUrls: [],
        },
        manager,
        undefined,
        `tok_${managerId}`,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(await serverRepository.findBySlug(`revoked-org-server-${suffix}`)).toBeNull();
  });
});
