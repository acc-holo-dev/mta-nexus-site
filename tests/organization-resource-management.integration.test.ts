import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationMembers,
  organizationRepository,
  productRepository,
  serverRepository,
  servers,
  userRepository,
} from "@nexus/db";
import { productService } from "../apps/web/src/lib/services/product-service";
import { serverService } from "../apps/web/src/lib/services/server-service";

describe("organization resource management integration", () => {
  it("allows direct organization owner and manage_products member without requiring owner membership row", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_authz_owner_${suffix}`;
    const managerId = `usr_authz_manager_${suffix}`;
    const creatorId = `usr_authz_creator_${suffix}`;
    const outsiderId = `usr_authz_outsider_${suffix}`;
    const organizationId = `org_authz_${suffix}`;
    const productId = `prd_authz_${suffix}`;

    for (const [id, label] of [
      [ownerId, "owner"],
      [managerId, "manager"],
      [creatorId, "creator"],
      [outsiderId, "outsider"],
    ] as const) {
      await userRepository.create({
        id,
        email: `authz_${label}_${suffix}@nexus.test`,
        username: `authz_${label}_${suffix}`,
        displayName: `Authz ${label}`,
        role: label === "creator" ? "developer" : "user",
      });
    }

    await organizationRepository.create({
      id: organizationId,
      name: "Authorization Organization",
      slug: `authorization-org-${suffix}`,
      ownerId,
    });
    await db.insert(organizationMembers).values({
      id: `om_authz_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_products"],
      createdAt: new Date(),
    });

    await productRepository.create({
      id: productId,
      title: "Organization Draft Resource",
      slug: `organization-draft-resource-${suffix}`,
      description: "Authorization integration resource.",
      type: "script",
      status: "draft",
      authorId: creatorId,
      organizationId,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: { dependencies: [] },
    });

    const product = await productRepository.findById(productId);
    expect(product).toBeTruthy();

    const owner = await userRepository.findById(ownerId);
    const manager = await userRepository.findById(managerId);
    const creator = await userRepository.findById(creatorId);
    const outsider = await userRepository.findById(outsiderId);
    expect(owner && manager && creator && outsider && product).toBeTruthy();
    if (!owner || !manager || !creator || !outsider || !product) return;

    expect(await productService.canManageProduct(product, owner)).toBe(true);
    expect(await productService.canManageProduct(product, manager)).toBe(true);
    expect(await productService.canManageProduct(product, creator)).toBe(false);
    expect(await productService.canManageProduct(product, outsider)).toBe(false);

    expect((await productService.getProductPreviewBySlug(product.slug, owner))?.id).toBe(productId);
    expect((await productService.getProductPreviewBySlug(product.slug, manager))?.id).toBe(
      productId,
    );
    expect(await productService.getProductPreviewBySlug(product.slug, outsider)).toBeNull();
  });

  it("requires explicit server-management rights for organization server creation", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
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
      await userRepository.create({
        id,
        email: `server_authz_${label}_${suffix}@nexus.test`,
        username: `server_authz_${label}_${suffix}`,
        displayName: `Server Authz ${label}`,
        role: "user",
      });
    }

    await organizationRepository.create({
      id: organizationId,
      name: "Server Authorization Organization",
      slug: `server-authorization-org-${suffix}`,
      ownerId,
    });

    await db.insert(organizationMembers).values([
      {
        id: `om_server_manager_${suffix}`,
        organizationId,
        userId: managerId,
        role: "member",
        permissions: ["manage_servers"],
        createdAt: new Date(),
      },
      {
        id: `om_server_developer_${suffix}`,
        organizationId,
        userId: developerId,
        role: "developer",
        permissions: [],
        createdAt: new Date(),
      },
    ]);

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
    );

    expect(created.organizationId).toBe(organizationId);
    expect(created.ownerId).toBeFalsy();
    expect(await serverService.canManageServer(created, manager)).toBe(true);

    // The owner-picker is only a hint. Authorization is re-read by the
    // same transaction that inserts the server and its audit event.
    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, managerId),
        ),
      );
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
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(await serverRepository.findBySlug(`revoked-org-server-${suffix}`)).toBeNull();
  });

  it("revokes organization resource authority when manage_products membership is removed", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_org_product_owner_${suffix}`;
    const managerId = `usr_org_product_manager_${suffix}`;
    const organizationId = `org_product_authority_${suffix}`;

    await userRepository.create({
      id: ownerId,
      email: `org_product_owner_${suffix}@nexus.test`,
      username: `org_product_owner_${suffix}`,
      displayName: "Org Product Owner",
      role: "user",
    });
    await userRepository.create({
      id: managerId,
      email: `org_product_manager_${suffix}@nexus.test`,
      username: `org_product_manager_${suffix}`,
      displayName: "Org Product Manager",
      role: "developer",
    });

    await organizationRepository.create({
      id: organizationId,
      name: "Organization Product Authority",
      slug: `organization-product-authority-${suffix}`,
      ownerId,
    });
    await db.insert(organizationMembers).values({
      id: `om_product_authority_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_products"],
      createdAt: new Date(),
    });

    const manager = await userRepository.findById(managerId);
    expect(manager).toBeTruthy();
    if (!manager) return;

    const product = await productService.createProduct(
      {
        title: "Delegated Organization Resource",
        slug: `delegated-organization-resource-${suffix}`,
        description: "Organization-owned resource created by a delegated product manager.",
        type: "script",
        status: "draft",
        authorId: managerId,
        organizationId,
        price: 0,
        currency: "USD",
        licenseModel: "unlimited",
        tags: [],
        currentVersion: "0.1.0",
        isFeatured: false,
        screenshots: [],
        compatibility: { dependencies: [] },
      },
      manager,
    );

    expect(product.authorId).toBe(managerId);
    expect(product.organizationId).toBe(organizationId);
    expect(await productService.canManageProduct(product, manager)).toBe(true);

    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, managerId),
        ),
      );

    expect(await productService.canManageProduct(product, manager)).toBe(false);
    expect(await productService.getProductPreviewBySlug(product.slug, manager)).toBeNull();

    const owner = await userRepository.findById(ownerId);
    expect(owner).toBeTruthy();
    if (!owner) return;
    expect(await productService.canManageProduct(product, owner)).toBe(true);
  });

  it("ignores legacy personal ownerId on organization servers after organization authority is revoked", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const orgOwnerId = `usr_legacy_org_owner_${suffix}`;
    const legacyOwnerId = `usr_legacy_server_owner_${suffix}`;
    const organizationId = `org_legacy_server_${suffix}`;

    await userRepository.create({
      id: orgOwnerId,
      email: `legacy_org_owner_${suffix}@nexus.test`,
      username: `legacy_org_owner_${suffix}`,
      displayName: "Legacy Org Owner",
      role: "user",
    });
    await userRepository.create({
      id: legacyOwnerId,
      email: `legacy_server_owner_${suffix}@nexus.test`,
      username: `legacy_server_owner_${suffix}`,
      displayName: "Legacy Server Owner",
      role: "user",
    });

    await organizationRepository.create({
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
