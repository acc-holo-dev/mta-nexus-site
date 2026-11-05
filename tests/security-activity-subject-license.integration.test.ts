import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";
import { auditEvents, licenses, products } from "../packages/db/src/schema";
import {
  clearFixtures,
  db,
  fixture,
  seedSubjectUsers,
  setupSecurityActivitySubject,
} from "./helpers/security-activity-subject-harness";

setupSecurityActivitySubject();

describe("security activity subject lookup: license ownership", () => {
  it("returns admin and system license events for the owner via license ownership", async () => {
    await clearFixtures();
    await seedSubjectUsers();
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
});
