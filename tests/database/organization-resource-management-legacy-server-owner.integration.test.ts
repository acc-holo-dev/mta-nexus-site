import { describe, expect, it } from "vitest";
import {
  createOrganization,
  createOrgSession,
  createOrgUser,
  db,
  eq,
  fixtureSuffix,
  serverRepository,
  serverService,
  servers,
  userRepository,
} from "../helpers/organization-resource-management-harness";

describe("organization resource management: legacy server owner", () => {
  it("ignores legacy personal ownerId on organization servers after organization authority is revoked", async () => {
    const suffix = fixtureSuffix("legacy_server");
    const orgOwnerId = `usr_legacy_org_owner_${suffix}`;
    const legacyOwnerId = `usr_legacy_server_owner_${suffix}`;
    const organizationId = `org_legacy_server_${suffix}`;

    await createOrgUser({
      id: orgOwnerId,
      email: `legacy_org_owner_${suffix}@nexus.test`,
      username: `legacy_org_owner_${suffix}`,
      displayName: "Legacy Org Owner",
    });
    await createOrgSession(orgOwnerId);
    await createOrgUser({
      id: legacyOwnerId,
      email: `legacy_server_owner_${suffix}@nexus.test`,
      username: `legacy_server_owner_${suffix}`,
      displayName: "Legacy Server Owner",
    });

    await createOrganization({
      id: organizationId,
      name: "Legacy Server Organization",
      slug: `legacy-server-organization-${suffix}`,
      ownerId: orgOwnerId,
    });

    const organizationOwner = await userRepository.findById(orgOwnerId);
    if (!organizationOwner) throw new Error("Expected organization owner fixture");
    const legacy = await serverService.createServer(
      {
        name: "Legacy Organization Server",
        slug: `legacy-organization-server-${suffix}`,
        ipAddress: "198.51.100.230",
        port: 22003 + (process.pid % 1000),
        organizationId,
        visibility: "private",
        gameplayTags: [],
        mediaUrls: [],
      },
      organizationOwner,
      undefined,
      `tok_${orgOwnerId}`,
    );

    // Simulate a historical ownerId directly; production update deliberately
    // cannot transfer organization authority through a server edit.
    await db.update(servers).set({ ownerId: legacyOwnerId }).where(eq(servers.id, legacy.id));
    const withLegacyOwner = await serverRepository.findById(legacy.id);
    expect(withLegacyOwner?.organizationId).toBe(organizationId);
    expect(withLegacyOwner?.ownerId).toBe(legacyOwnerId);

    const legacyOwner = await userRepository.findById(legacyOwnerId);
    const orgOwner = await userRepository.findById(orgOwnerId);
    expect(legacyOwner && orgOwner && withLegacyOwner).toBeTruthy();
    if (!legacyOwner || !orgOwner || !withLegacyOwner) return;

    expect(await serverService.canManageServer(withLegacyOwner, legacyOwner)).toBe(false);
    expect(await serverService.canManageServer(withLegacyOwner, orgOwner)).toBe(true);
  });
});
