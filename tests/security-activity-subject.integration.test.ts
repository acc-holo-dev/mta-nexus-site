import { randomUUID } from "node:crypto";
import { auditEvents, auditRepository, db, userRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";
import { licenses, products, users } from "../packages/db/src/schema";

const auditIds = [
  "aud_secsub_login",
  "aud_secsub_removed",
  "aud_secsub_other",
  "aud_secsub_foreign",
  "aud_secsub_owner",
  "aud_secsub_self_remove",
  "aud_secsub_lic_suspend",
  "aud_secsub_lic_expired",
  "aud_secsub_lic_other",
];

const fixture = {
  userId: "usr_secsub_member",
  otherUserId: "usr_secsub_other_owner",
  productId: "prd_secsub_lic",
  otherProductId: "prd_secsub_lic_other",
  licenseId: "lic_secsub_owned",
  otherLicenseId: "lic_secsub_other",
};

async function clearFixtures() {
  await db.delete(auditEvents).where(inArray(auditEvents.id, auditIds));
  await db
    .delete(licenses)
    .where(inArray(licenses.id, [fixture.licenseId, fixture.otherLicenseId]));
  await db
    .delete(products)
    .where(inArray(products.id, [fixture.productId, fixture.otherProductId]));
  await db
    .delete(users)
    .where(inArray(users.id, [fixture.userId, fixture.otherUserId]));
}

describe("security activity subject lookup", () => {
  afterEach(async () => {
    await clearFixtures();
  });

  it("returns own actions and organization changes that name the account", async () => {
    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_login",
        actorId: "usr_secsub_member",
        actorType: "user",
        action: "user.logged_in",
        targetId: "usr_secsub_member",
        targetType: "user",
        createdAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_removed",
        actorId: "usr_secsub_admin",
        actorType: "user",
        action: "organization.member_removed",
        targetId: "org_secsub",
        targetType: "organization",
        ipAddress: "198.51.100.8",
        userAgent: "Staff Browser",
        details: { userId: "usr_secsub_member", note: "private-note" },
        createdAt: new Date("2026-10-02T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_other",
        actorId: "usr_secsub_admin",
        actorType: "user",
        action: "organization.member_removed",
        targetId: "org_secsub",
        targetType: "organization",
        details: { userId: "usr_secsub_someone" },
        createdAt: new Date("2026-10-03T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_foreign",
        actorId: "usr_secsub_admin",
        actorType: "user",
        action: "product.created",
        targetId: "prd_secsub",
        targetType: "product",
        details: { userId: "usr_secsub_member" },
        createdAt: new Date("2026-10-04T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_owner",
        actorId: "usr_secsub_admin",
        actorType: "user",
        action: "organization.ownership_transferred",
        targetId: "org_secsub",
        targetType: "organization",
        details: {
          previousOwnerId: "usr_secsub_admin",
          newOwnerId: "usr_secsub_member",
          formerOwnerRole: "admin",
        },
        createdAt: new Date("2026-10-05T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_self_remove",
        actorId: "usr_secsub_member",
        actorType: "user",
        action: "organization.member_removed",
        targetId: "org_secsub",
        targetType: "organization",
        details: { userId: "usr_secsub_someone", note: "actor-private" },
        createdAt: new Date("2026-10-06T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity("usr_secsub_member", 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_self_remove", "actor", "organization.member_removed"],
      ["aud_secsub_owner", "subject", "organization.ownership_transferred"],
      ["aud_secsub_removed", "subject", "organization.member_removed"],
      ["aud_secsub_login", "actor", "user.logged_in"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-note");
    expect(serialized).not.toContain("actor-private");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("198.51.100.8");
    expect(serialized).not.toContain("formerOwnerRole");
    expect(serialized).not.toContain("Staff Browser");
  });

  it("returns admin and system license events for the owner via license ownership", async () => {
    await clearFixtures();
    await userRepository.create({
      id: fixture.userId,
      email: `${fixture.userId}@example.invalid`,
      username: fixture.userId,
      displayName: "Subject member",
      role: "user",
    });
    await userRepository.create({
      id: fixture.otherUserId,
      email: `${fixture.otherUserId}@example.invalid`,
      username: fixture.otherUserId,
      displayName: "Other owner",
      role: "user",
    });
    await db.insert(products).values([
      {
        id: fixture.productId,
        authorId: fixture.userId,
        title: "Subject license product",
        slug: "secsub-lic-owned",
        description: "Disposable security subject fixture",
        type: "script",
        status: "draft",
      },
      {
        id: fixture.otherProductId,
        authorId: fixture.otherUserId,
        title: "Other license product",
        slug: "secsub-lic-other",
        description: "Disposable security subject fixture",
        type: "script",
        status: "draft",
      },
    ]);
    await db.insert(licenses).values([
      {
        id: fixture.licenseId,
        userId: fixture.userId,
        productId: fixture.productId,
        key: randomUUID(),
        model: "single_server",
        status: "active",
      },
      {
        id: fixture.otherLicenseId,
        userId: fixture.otherUserId,
        productId: fixture.otherProductId,
        key: randomUUID(),
        model: "single_server",
        status: "active",
      },
    ]);

    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_lic_suspend",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "license.suspended",
        targetId: fixture.licenseId,
        targetType: "license",
        ipAddress: "203.0.113.9",
        userAgent: "Moderator",
        details: {
          userId: fixture.userId,
          reason: "staff-private",
          previousStatus: "active",
          status: "suspended",
        },
        createdAt: new Date("2026-10-07T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_lic_expired",
        actorId: "system:license-maintenance",
        actorType: "system",
        action: "license.expired",
        targetId: fixture.licenseId,
        targetType: "license",
        details: {
          userId: fixture.userId,
          previousStatus: "active",
          status: "expired",
          notified: true,
        },
        createdAt: new Date("2026-10-08T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_lic_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "license.revoked",
        targetId: fixture.otherLicenseId,
        targetType: "license",
        details: { userId: fixture.otherUserId, reason: "other-owner" },
        createdAt: new Date("2026-10-09T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_lic_expired", "subject", "license.expired"],
      ["aud_secsub_lic_suspend", "subject", "license.suspended"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("staff-private");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.9");
    expect(serialized).not.toContain("Moderator");
    expect(serialized).not.toContain(fixture.otherLicenseId);
  });

  it("rejects an invalid account id before reading audit rows", async () => {
    await expect(
      auditRepository.listAccountActivity("usr bad", ["user.logged_in"], 5),
    ).rejects.toBeInstanceOf(AppError);
  });
});
