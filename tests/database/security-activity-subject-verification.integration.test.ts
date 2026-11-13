import { describe, expect, it } from "vitest";
import { SecurityCenterService } from "../../site/src/lib/services/security-center-service";
import { auditEvents, verificationRequests } from "../../packages/db/src/schema";
import {
  clearFixtures,
  db,
  fixture,
  seedSubjectUsers,
  setupSecurityActivitySubject,
} from "../helpers/security-activity-subject-harness";

setupSecurityActivitySubject();

describe("security activity subject lookup: verification and server-claim ownership", () => {
  it("returns staff verification decisions for the requester via request ownership", async () => {
    await clearFixtures();
    await seedSubjectUsers();
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
    await seedSubjectUsers();
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
});
