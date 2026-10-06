import { describe, it, expect } from "vitest";
import { can, getStaticCapabilities } from "@nexus/security";
import type { User, Product } from "@nexus/domain";

describe("Security Policy Engine can()", () => {
  const adminUser: User = {
    id: "usr_admin",
    email: "admin@nexus.test",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const devUser: User = {
    id: "usr_dev",
    email: "dev@nexus.test",
    username: "dev_john",
    displayName: "John Developer",
    role: "developer",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const regularUser: User = {
    id: "usr_regular",
    email: "user@nexus.test",
    username: "regular_user",
    displayName: "Regular User",
    role: "user",
    isVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const moderatorUser: User = {
    id: "usr_moderator",
    email: "moderator@nexus.test",
    username: "moderator",
    displayName: "Moderator",
    role: "moderator",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ownedProduct: Partial<Product> = {
    id: "prd_1",
    authorId: "usr_dev",
  };

  const foreignProduct: Partial<Product> = {
    id: "prd_2",
    authorId: "usr_other_author",
  };

  it("should permit admin access to all actions", () => {
    expect(can(adminUser, "admin.access")).toBe(true);
    expect(can(adminUser, "product.update", foreignProduct)).toBe(true);
    expect(can(adminUser, "server.delete")).toBe(true);
  });

  it("should deny non-admin access to admin areas", () => {
    expect(can(devUser, "admin.access")).toBe(false);
    expect(can(regularUser, "admin.access")).toBe(false);
    expect(can(null, "admin.access")).toBe(false);
  });

  it("should grant moderators queue access without exposing audit history", () => {
    expect(can(moderatorUser, "admin.access")).toBe(true);
    expect(can(moderatorUser, "admin.moderation")).toBe(true);
    expect(can(moderatorUser, "admin.audit")).toBe(false);
    expect(getStaticCapabilities("moderator")).toContain("admin.moderation");
  });

  it("should permit product author to update their product", () => {
    expect(can(devUser, "product.update", ownedProduct)).toBe(true);
  });

  it("should forbid regular user or non-author from updating product", () => {
    expect(can(regularUser, "product.update", ownedProduct)).toBe(false);
    expect(can(devUser, "product.update", foreignProduct)).toBe(false);
  });
});
