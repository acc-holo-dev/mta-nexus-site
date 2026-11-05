import { describe, expect, it } from "vitest";
import { SecurityCenterService } from "../apps/web/src/lib/services/security-center-service";
import { auditEvents } from "../packages/db/src/schema";
import {
  clearFixtures,
  db,
  fixture,
  quarantineProduct,
  seedSubjectUsers,
  servedReceipt,
  setupSecurityActivitySubject,
  startedReceipt,
} from "./helpers/security-activity-subject-harness";

setupSecurityActivitySubject();

describe("security activity subject lookup: notified build quarantines", () => {
  it("returns notified build quarantines only for served downloaders", async () => {
    await clearFixtures();
    await seedSubjectUsers("developer");
    await quarantineProduct(
      fixture.quarantineProductId,
      fixture.quarantineBuildId,
      fixture.otherUserId,
    );
    await quarantineProduct(
      fixture.otherQuarantineProductId,
      fixture.otherQuarantineBuildId,
      fixture.otherUserId,
    );
    await servedReceipt(
      fixture.userId,
      fixture.quarantineProductId,
      fixture.quarantineBuildId,
      fixture.quarantineEntitlementId,
    );
    await startedReceipt(
      fixture.otherUserId,
      fixture.otherQuarantineProductId,
      fixture.otherQuarantineBuildId,
      fixture.otherQuarantineEntitlementId,
    );

    await db.insert(auditEvents).values([
      {
        id: "aud_secsub_build_notify",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "build.quarantined",
        targetId: fixture.quarantineBuildId,
        targetType: "build",
        ipAddress: "203.0.113.91",
        userAgent: "Moderator Console",
        details: {
          reason: "PRIVATE_MALWARE_REASON",
          notifyAffectedDownloaders: true,
          version: "1.0.0",
        },
        createdAt: new Date("2026-10-19T00:00:00.000Z"),
      },
      {
        id: "aud_secsub_build_silent",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "build.quarantined",
        targetId: fixture.quarantineBuildId,
        targetType: "build",
        details: {
          reason: "PRIVATE_SILENT_REASON",
          notifyAffectedDownloaders: false,
        },
        createdAt: new Date("2026-10-19T01:00:00.000Z"),
      },
      {
        id: "aud_secsub_build_other",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "build.quarantined",
        targetId: fixture.otherQuarantineBuildId,
        targetType: "build",
        details: { notifyAffectedDownloaders: true, reason: "OTHER_BUILD" },
        createdAt: new Date("2026-10-19T02:00:00.000Z"),
      },
      {
        id: "aud_secsub_build_started_only",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "build.quarantined",
        targetId: fixture.otherQuarantineBuildId,
        targetType: "build",
        details: { notifyAffectedDownloaders: true, reason: "STARTED_ONLY" },
        createdAt: new Date("2026-10-19T03:00:00.000Z"),
      },
      {
        id: "aud_secsub_build_restore",
        actorId: "usr_secsub_admin",
        actorType: "admin",
        action: "build.quarantine_restored",
        targetId: fixture.quarantineBuildId,
        targetType: "build",
        details: { reason: "PRIVATE_RESTORE_REASON" },
        createdAt: new Date("2026-10-19T04:00:00.000Z"),
      },
    ]);

    const result = await new SecurityCenterService().listActivity(fixture.userId, 20);
    const quarantines = result.filter((item) => item.action.startsWith("build.quarantine"));
    expect(quarantines.map((item) => [item.id, item.perspective, item.action])).toEqual([
      ["aud_secsub_build_notify", "subject", "build.quarantined"],
    ]);
    const serialized = JSON.stringify(quarantines);
    expect(serialized).not.toContain("PRIVATE_MALWARE_REASON");
    expect(serialized).not.toContain("PRIVATE_SILENT_REASON");
    expect(serialized).not.toContain("PRIVATE_RESTORE_REASON");
    expect(serialized).not.toContain("usr_secsub_admin");
    expect(serialized).not.toContain("203.0.113.91");
    expect(serialized).not.toContain("Moderator Console");
    expect(serialized).not.toContain(fixture.otherQuarantineBuildId);
    expect(serialized).not.toContain("build.quarantine_restored");
  });
});
