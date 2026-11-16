import { describe, expect, it } from "vitest";
import { SecurityCenterService } from "../../src/lib/services/security-center-service";
import { auditEvents, supportCases } from "../../packages/db/src/schema";
import {
  clearFixtures,
  db,
  fixture,
  seedSubjectUsers,
  setupSecurityActivitySubject,
} from "../helpers/security-activity-subject-harness";

setupSecurityActivitySubject();

describe("security activity subject lookup: support and order-case ownership", () => {
  it("returns staff order-case reviews for the requester via support case ownership", async () => {
    await clearFixtures();
    await seedSubjectUsers();
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

  it("returns staff support status changes and replies for the requester via support case ownership", async () => {
    await clearFixtures();
    await seedSubjectUsers();
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
        id: "aud_secsub_support_message",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "support.message.created",
        targetId: fixture.caseId,
        targetType: "support_case",
        ipAddress: "203.0.113.81",
        userAgent: "Staff Console",
        details: { authorRole: "staff", body: "private-staff-reply" },
        createdAt: new Date("2026-10-16T01:00:00.000Z"),
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
      {
        id: "aud_secsub_support_other_message",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "support.message.created",
        targetId: fixture.otherCaseId,
        targetType: "support_case",
        details: { authorRole: "staff" },
        createdAt: new Date("2026-10-17T01:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_support_message", "subject", "support.message.created"],
      ["aud_secsub_support_status", "subject", "support.case.status_changed"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("staff-private");
    expect(serialized).not.toContain("private-staff-reply");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.80");
    expect(serialized).not.toContain("Staff Console");
    expect(serialized).not.toContain(fixture.otherCaseId);
  });
});
