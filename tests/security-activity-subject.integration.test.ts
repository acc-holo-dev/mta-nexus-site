import { auditEvents, auditRepository, db } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";

const ids = [
  "aud_secsub_login",
  "aud_secsub_removed",
  "aud_secsub_other",
  "aud_secsub_foreign",
  "aud_secsub_owner",
  "aud_secsub_self_remove",
];

describe("security activity subject lookup", () => {
  afterEach(async () => {
    await db.delete(auditEvents).where(inArray(auditEvents.id, ids));
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

  it("rejects an invalid account id before reading audit rows", async () => {
    await expect(
      auditRepository.listAccountActivity("usr bad", ["user.logged_in"], 5),
    ).rejects.toBeInstanceOf(AppError);
  });
});
