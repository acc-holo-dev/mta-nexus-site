import { describe, expect, it } from "vitest";
import {
  addOrganizationMember,
  assertProductMutationAuthority,
  createOrganization,
  createOrgUser,
  db,
  fixtureSuffix,
  productRepository,
  productService,
  userRepository,
} from "../helpers/organization-resource-management-harness";

describe("organization resource management: product authority", () => {
  it("allows direct organization owner and manage_products member without requiring owner membership row", async () => {
    const suffix = fixtureSuffix("authz");
    const ownerId = `usr_authz_owner_${suffix}`;
    const managerId = `usr_authz_manager_${suffix}`;
    const creatorId = `usr_authz_creator_${suffix}`;
    const outsiderId = `usr_authz_outsider_${suffix}`;
    const staleId = `usr_authz_stale_${suffix}`;
    const organizationId = `org_authz_${suffix}`;
    const productId = `prd_authz_${suffix}`;

    for (const [id, label] of [
      [ownerId, "owner"],
      [managerId, "manager"],
      [creatorId, "creator"],
      [outsiderId, "outsider"],
      [staleId, "stale"],
    ] as const) {
      await createOrgUser({
        id,
        email: `authz_${label}_${suffix}@nexus.test`,
        username: `authz_${label}_${suffix}`,
        displayName: `Authz ${label}`,
        role: label === "creator" ? "developer" : "user",
      });
    }

    await createOrganization({
      id: organizationId,
      name: "Authorization Organization",
      slug: `authorization-org-${suffix}`,
      ownerId,
    });
    await addOrganizationMember({
      id: `om_authz_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_products"],
    });
    await addOrganizationMember({
      id: `om_authz_stale_${suffix}`,
      organizationId,
      userId: staleId,
      role: "owner",
      permissions: ["manage_products"],
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
    const stale = await userRepository.findById(staleId);
    expect(owner && manager && creator && outsider && stale && product).toBeTruthy();
    if (!owner || !manager || !creator || !outsider || !stale || !product) return;

    expect(await productService.canManageProduct(product, owner)).toBe(true);
    expect(await productService.canManageProduct(product, manager)).toBe(true);
    expect(await productService.canManageProduct(product, creator)).toBe(false);
    expect(await productService.canManageProduct(product, outsider)).toBe(false);
    expect(await productService.canManageProduct(product, stale)).toBe(false);
    await expect(
      db.transaction((tx) =>
        assertProductMutationAuthority(
          tx,
          { ...product, organizationId: product.organizationId ?? null },
          stale.id,
        ),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      db.transaction((tx) =>
        assertProductMutationAuthority(
          tx,
          { ...product, organizationId: product.organizationId ?? null },
          manager.id,
        ),
      ),
    ).resolves.toMatchObject({ id: manager.id });

    expect((await productService.getProductPreviewBySlug(product.slug, owner))?.id).toBe(productId);
    expect((await productService.getProductPreviewBySlug(product.slug, manager))?.id).toBe(
      productId,
    );
    expect(await productService.getProductPreviewBySlug(product.slug, outsider)).toBeNull();
    expect(await productService.getProductPreviewBySlug(product.slug, stale)).toBeNull();
  });
});
