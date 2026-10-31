import { randomUUID } from "node:crypto";
import { auditEvents, auditRepository, db, userRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";
import {
  licenses,
  products,
  supportCases,
  users,
  verificationRequests,
} from "../packages/db/src/schema";

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
  "aud_secsub_case_reviewed",
  "aud_secsub_case_other",
  "aud_secsub_ver_approved",
  "aud_secsub_ver_rejected",
  "aud_secsub_ver_other",
  "aud_server_verification_ver_secsub_srv",
  "aud_server_verification_ver_secsub_srv_other",
  "aud_secsub_support_status",
  "aud_secsub_support_other",
];

const fixture = {
  userId: "usr_secsub_member",
  otherUserId: "usr_secsub_other_owner",
  productId: "prd_secsub_lic",
  otherProductId: "prd_secsub_lic_other",
  licenseId: "lic_secsub_owned",
  otherLicenseId: "lic_secsub_other",
  caseId: "case_secsub_owned",
  otherCaseId: "case_secsub_other",
  verificationId: "ver_secsub_owned",
  otherVerificationId: "ver_secsub_other",
  serverVerificationId: "ver_secsub_srv",
  otherServerVerificationId: "ver_secsub_srv_other",
  serverId: "srv_secsub_owned",
  otherServerId: "srv_secsub_other",
};

async function clearFixtures() {
  await db.delete(auditEvents).where(inArray(auditEvents.id, auditIds));
  await db
    .delete(verificationRequests)
    .where(
      inArray(verificationRequests.id, [
        fixture.verificationId,
        fixture.otherVerificationId,
        fixture.serverVerificationId,
        fixture.otherServerVerificationId,
      ]),
    );
  await db
    .delete(supportCases)
    .where(inArray(supportCases.id, [fixture.caseId, fixture.otherCaseId]));
  await db
    .delete(licenses)
    .where(inArray(licenses.id, [fixture.licenseId, fixture.otherLicenseId]));
  await db
    .delete(products)
    .where(inArray(products.id, [fixture.productId, fixture.otherProductId]));
  await db.delete(users).where(inArray(users.id, [fixture.userId, fixture.otherUserId]));
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

  it("returns staff order-case reviews for the requester via support case ownership", async () => {
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
    await db.insert(supportCases).values([
      {
        id: fixture.caseId,
        requesterId: fixture.userId,
        category: "purchase",
        subject: "Owned order case",
        status: "open",
        relatedType: "purchase",
        relatedId: "ord_secsub_owned",
      },
      {
        id: fixture.otherCaseId,
        requesterId: fixture.otherUserId,
        category: "purchase",
        subject: "Other order case",
        status: "open",
        relatedType: "purchase",
        relatedId: "ord_secsub_other",
      },
    ]);
    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_case_reviewed",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "commerce.order_case.reviewed",
        targetId: fixture.caseId,
        targetType: "support_case",
        ipAddress: "203.0.113.40",
        userAgent: "Staff Console",
        details: {
          orderId: "ord_secsub_owned",
          action: "resolve",
          notes: "staff-private-notes",
          evidence: { refundedRecordCount: 0 },
        },
        createdAt: new Date("2026-10-10T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_case_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "commerce.order_case.reviewed",
        targetId: fixture.otherCaseId,
        targetType: "support_case",
        details: { orderId: "ord_secsub_other", notes: "other-buyer" },
        createdAt: new Date("2026-10-11T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_case_reviewed", "subject", "commerce.order_case.reviewed"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("staff-private-notes");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.40");
    expect(serialized).not.toContain("Staff Console");
    expect(serialized).not.toContain(fixture.otherCaseId);
  });

  it("returns staff verification decisions for the requester via request ownership", async () => {
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
    await db.insert(verificationRequests).values([
      {
        id: fixture.verificationId,
        requesterId: fixture.userId,
        targetType: "developer",
        targetId: fixture.userId,
        status: "approved",
        reviewNotes: "staff-private-review",
      },
      {
        id: fixture.otherVerificationId,
        requesterId: fixture.otherUserId,
        targetType: "developer",
        targetId: fixture.otherUserId,
        status: "rejected",
        reviewNotes: "other-requester",
      },
    ]);
    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_ver_approved",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "verification.approved",
        targetId: fixture.verificationId,
        targetType: "verification",
        ipAddress: "203.0.113.55",
        userAgent: "Moderator Console",
        details: { notes: "staff-private-review" },
        createdAt: new Date("2026-10-12T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_ver_rejected",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "verification.rejected",
        targetId: fixture.verificationId,
        targetType: "verification",
        details: { notes: "earlier-private" },
        createdAt: new Date("2026-10-11T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_ver_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "verification.approved",
        targetId: fixture.otherVerificationId,
        targetType: "verification",
        details: { notes: "other-requester" },
        createdAt: new Date("2026-10-13T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_ver_approved", "subject", "verification.approved"],
      ["aud_secsub_ver_rejected", "subject", "verification.rejected"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("staff-private-review");
    expect(serialized).not.toContain("earlier-private");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.55");
    expect(serialized).not.toContain("Moderator Console");
    expect(serialized).not.toContain(fixture.otherVerificationId);
  });

  it("returns staff server-claim outcomes for the requester via verification request id", async () => {
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
    await db.insert(verificationRequests).values([
      {
        id: fixture.serverVerificationId,
        requesterId: fixture.userId,
        targetType: "server",
        targetId: fixture.serverId,
        status: "approved",
      },
      {
        id: fixture.otherServerVerificationId,
        requesterId: fixture.otherUserId,
        targetType: "server",
        targetId: fixture.otherServerId,
        status: "rejected",
      },
    ]);
    await db.insert(auditEvents).values([
      {
        id: `aud_server_verification_${fixture.serverVerificationId}`,
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "server.verification_approved",
        targetId: fixture.serverId,
        targetType: "server",
        ipAddress: "203.0.113.70",
        userAgent: "Moderator Console",
        createdAt: new Date("2026-10-14T00:00:00.000Z"),
      },
      {
        id: `aud_server_verification_${fixture.otherServerVerificationId}`,
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "server.verification_rejected",
        targetId: fixture.otherServerId,
        targetType: "server",
        createdAt: new Date("2026-10-15T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      [
        `aud_server_verification_${fixture.serverVerificationId}`,
        "subject",
        "server.verification_approved",
      ],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.70");
    expect(serialized).not.toContain("Moderator Console");
    expect(serialized).not.toContain(fixture.otherServerId);
  });

  it("returns staff support status changes for the requester via support case ownership", async () => {
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
    await db.insert(supportCases).values([
      {
        id: fixture.caseId,
        requesterId: fixture.userId,
        category: "account",
        subject: "Owned support case",
        status: "resolved",
      },
      {
        id: fixture.otherCaseId,
        requesterId: fixture.otherUserId,
        category: "account",
        subject: "Other support case",
        status: "open",
      },
    ]);
    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_support_status",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: fixture.caseId,
        targetType: "support_case",
        ipAddress: "203.0.113.80",
        userAgent: "Staff Console",
        details: { from: "open", to: "resolved", notes: "staff-private" },
        createdAt: new Date("2026-10-16T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_support_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: fixture.otherCaseId,
        targetType: "support_case",
        details: { from: "open", to: "closed" },
        createdAt: new Date("2026-10-17T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_support_status", "subject", "support.case.status_changed"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("staff-private");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.80");
    expect(serialized).not.toContain("Staff Console");
    expect(serialized).not.toContain(fixture.otherCaseId);
  });

  it("rejects an invalid account id before reading audit rows", async () => {
    await expect(
      auditRepository.listAccountActivity("usr bad", ["user.logged_in"], 5),
    ).rejects.toBeInstanceOf(AppError);
  });
});
