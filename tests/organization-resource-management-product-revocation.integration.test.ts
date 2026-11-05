import { describe, expect, it } from "vitest";
import {
  addOrganizationMember,
  createOrganization,
  createOrgSession,
  createOrgUser,
  fixtureSuffix,
  productService,
  removeOrganizationMember,
  userRepository,
} from "./helpers/organization-resource-management-harness";

describe("organization resource management: product revocation", () => {
  it("revokes organization resource authority when manage_products membership is removed", async () => {
    const suffix = fixtureSuffix("product_authority");
    const ownerId = `usr_org_product_owner_${suffix}`;
    const managerId = `usr_org_product_manager_${suffix}`;
    const organizationId = `org_product_authority_${suffix}`;

    await createOrgUser({
      id: ownerId,
      email: `org_product_owner_${suffix}@nexus.test`,
      username: `org_product_owner_${suffix}`,
      displayName: "Org Product Owner",
    });
    await createOrgUser({
      id: managerId,
      email: `org_product_manager_${suffix}@nexus.test`,
      username: `org_product_manager_${suffix}`,
      displayName: "Org Product Manager",
      role: "developer",
    });
    await createOrgSession(managerId);

    await createOrganization({
      id: organizationId,
      name: "Organization Product Authority",
      slug: `organization-product-authority-${suffix}`,
      ownerId,
    });
    await addOrganizationMember({
      id: `om_product_authority_${suffix}`,
      organizationId,
      userId: managerId,
      role: "member",
      permissions: ["manage_products"],
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
      `tok_${managerId}`,
    );

    expect(product.authorId).toBe(managerId);
    expect(product.organizationId).toBe(organizationId);
    expect(await productService.canManageProduct(product, manager)).toBe(true);

    await removeOrganizationMember(organizationId, managerId);

    expect(await productService.canManageProduct(product, manager)).toBe(false);
    expect(await productService.getProductPreviewBySlug(product.slug, manager)).toBeNull();

    const owner = await userRepository.findById(ownerId);
    expect(owner).toBeTruthy();
    if (!owner) return;
    expect(await productService.canManageProduct(product, owner)).toBe(true);
  });
});
