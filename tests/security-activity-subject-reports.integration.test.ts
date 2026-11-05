import { describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";
import { auditEvents, reports } from "../packages/db/src/schema";
import {
  clearFixtures,
  db,
  fixture,
  seedSubjectUsers,
  setupSecurityActivitySubject,
} from "./helpers/security-activity-subject-harness";

setupSecurityActivitySubject();

describe("security activity subject lookup: community-report ownership", () => {
  it("returns staff community-report decisions for the reporter via report ownership", async () => {
    await clearFixtures();
    await seedSubjectUsers();
    await db.insert(reports).values([
      {
        id: fixture.reportId,
        reporterId: fixture.userId,
        targetType: "content",
        targetId: "cnt_secsub_owned",
        type: "abuse",
        reason: "PRIVATE_REPORT_REASON",
        status: "resolved",
      },
      {
        id: fixture.otherReportId,
        reporterId: fixture.otherUserId,
        targetType: "content",
        targetId: "cnt_secsub_other",
        type: "abuse",
        reason: "OTHER_PRIVATE_REASON",
        status: "dismissed",
      },
    ]);
    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_report_resolve",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "report.resolve",
        targetId: fixture.reportId,
        targetType: "report",
        ipAddress: "203.0.113.90",
        userAgent: "Moderator Console",
        details: { notes: "PRIVATE_MOD_NOTES", previousStatus: "under_review", status: "resolved" },
        createdAt: new Date("2026-10-18T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_report_dismiss",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "report.dismiss",
        targetId: fixture.reportId,
        targetType: "report",
        details: { notes: "earlier-private", previousStatus: "open", status: "dismissed" },
        createdAt: new Date("2026-10-17T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_report_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "report.resolve",
        targetId: fixture.otherReportId,
        targetType: "report",
        details: { notes: "other-reporter" },
        createdAt: new Date("2026-10-19T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_report_self",
        actorId: fixture.userId,
        actorType: "user",
        action: "report.resolve",
        targetId: fixture.reportId,
        targetType: "report",
        details: { notes: "self-actor-should-use-actor-path-only-if-allowlisted" },
        createdAt: new Date("2026-10-16T00:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    expect(result.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_report_resolve", "subject", "report.resolve"],
      ["aud_secsub_report_dismiss", "subject", "report.dismiss"],
      ["aud_secsub_report_self", "actor", "report.resolve"],
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("PRIVATE_MOD_NOTES");
    expect(serialized).not.toContain("earlier-private");
    expect(serialized).not.toContain("PRIVATE_REPORT_REASON");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.90");
    expect(serialized).not.toContain("Moderator Console");
    expect(serialized).not.toContain(fixture.otherReportId);
  });
});
