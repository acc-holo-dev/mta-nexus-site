import { describe, expect, it } from "vitest";
import {
  SECURITY_SUBJECT_LABEL_KEYS,
  toSecurityActivityItem,
} from "./helpers/security-activity-harness";

describe("security activity staff outcome projection", () => {
  it("shows staff order-case reviews to the buyer without notes, evidence, or staff network", () => {
    const reviewed = toSecurityActivityItem(
      {
        id: "aud_case_reviewed",
        actorId: "usr_staff",
        action: "commerce.order_case.reviewed",
        targetType: "support_case",
        ipAddress: "203.0.113.40",
        userAgent: "Staff Console",
        details: {
          orderId: "ord_private",
          action: "resolve",
          notes: "staff-private-notes",
          evidence: { refundedRecordCount: 0 },
        },
        createdAt: new Date("2026-10-09T00:00:00.000Z"),
      },
      "usr_buyer",
    );
    expect(reviewed).toEqual({
      id: "aud_case_reviewed",
      action: "commerce.order_case.reviewed",
      targetType: "support_case",
      perspective: "subject",
      createdAt: new Date("2026-10-09T00:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["commerce.order_case.reviewed"]).toBe(
      "orderCaseReviewedNotice",
    );
    expect(JSON.stringify(reviewed)).not.toContain("usr_staff");
    expect(JSON.stringify(reviewed)).not.toContain("staff-private-notes");
    expect(JSON.stringify(reviewed)).not.toContain("ord_private");
    expect(JSON.stringify(reviewed)).not.toContain("203.0.113.40");
  });

  it("shows staff verification decisions to the requester without notes or staff network", () => {
    const approved = toSecurityActivityItem(
      {
        id: "aud_ver_approved",
        actorId: "usr_staff",
        action: "verification.approved",
        targetType: "verification",
        ipAddress: "203.0.113.55",
        userAgent: "Moderator Console",
        details: { notes: "staff-private-review" },
        createdAt: new Date("2026-10-12T00:00:00.000Z"),
      },
      "usr_requester",
    );
    expect(approved).toEqual({
      id: "aud_ver_approved",
      action: "verification.approved",
      targetType: "verification",
      perspective: "subject",
      createdAt: new Date("2026-10-12T00:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["verification.approved"]).toBe("verificationApprovedNotice");
    expect(SECURITY_SUBJECT_LABEL_KEYS["verification.rejected"]).toBe("verificationRejectedNotice");
    expect(JSON.stringify(approved)).not.toContain("usr_staff");
    expect(JSON.stringify(approved)).not.toContain("staff-private-review");
    expect(JSON.stringify(approved)).not.toContain("203.0.113.55");
    expect(
      toSecurityActivityItem(
        {
          id: "aud_ver_rejected",
          actorId: "usr_staff",
          action: "verification.rejected",
          targetType: "verification",
          details: { notes: "needs-more-proof" },
          createdAt: new Date("2026-10-12T01:00:00.000Z"),
        },
        "usr_requester",
      ),
    ).toMatchObject({ perspective: "subject", action: "verification.rejected" });
  });

  it("maps requester verification and control-proof actions without leaking details", () => {
    const requested = toSecurityActivityItem({
      id: "aud_ver_requested",
      actorId: "usr_requester",
      action: "verification.requested",
      targetType: "verification",
      details: { proofMethod: "mta_master_name_challenge", challengeId: "ch_private" },
      createdAt: new Date("2026-10-12T02:00:00.000Z"),
    });
    expect(requested).toEqual({
      id: "aud_ver_requested",
      action: "verification.requested",
      targetType: "verification",
      perspective: "actor",
      createdAt: new Date("2026-10-12T02:00:00.000Z"),
    });
    expect(JSON.stringify(requested)).not.toContain("ch_private");
    expect(
      toSecurityActivityItem({
        id: "aud_proof",
        actorId: "usr_requester",
        action: "server.control_proof_recorded",
        targetType: "server",
        createdAt: new Date("2026-10-12T03:00:00.000Z"),
      })?.action,
    ).toBe("server.control_proof_recorded");
  });

  it("shows staff server-claim outcomes to the requester without staff network", () => {
    const approved = toSecurityActivityItem(
      {
        id: "aud_server_verification_ver_owned",
        actorId: "usr_staff",
        action: "server.verification_approved",
        targetType: "server",
        ipAddress: "203.0.113.70",
        userAgent: "Moderator Console",
        details: { reason: "staff-private" },
        createdAt: new Date("2026-10-14T00:00:00.000Z"),
      },
      "usr_claimer",
    );
    expect(approved).toEqual({
      id: "aud_server_verification_ver_owned",
      action: "server.verification_approved",
      targetType: "server",
      perspective: "subject",
      createdAt: new Date("2026-10-14T00:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["server.verification_approved"]).toBe(
      "serverVerificationApprovedNotice",
    );
    expect(SECURITY_SUBJECT_LABEL_KEYS["server.verification_rejected"]).toBe(
      "serverVerificationRejectedNotice",
    );
    expect(JSON.stringify(approved)).not.toContain("usr_staff");
    expect(JSON.stringify(approved)).not.toContain("staff-private");
    expect(JSON.stringify(approved)).not.toContain("203.0.113.70");
  });

  it("shows staff support status changes to the requester without from/to details or staff network", () => {
    const changed = toSecurityActivityItem(
      {
        id: "aud_support_status",
        actorId: "usr_staff",
        action: "support.case.status_changed",
        targetType: "support_case",
        ipAddress: "203.0.113.80",
        userAgent: "Staff Console",
        details: { from: "open", to: "resolved", notes: "staff-private" },
        createdAt: new Date("2026-10-16T00:00:00.000Z"),
      },
      "usr_requester",
    );
    expect(changed).toEqual({
      id: "aud_support_status",
      action: "support.case.status_changed",
      targetType: "support_case",
      perspective: "subject",
      createdAt: new Date("2026-10-16T00:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["support.case.status_changed"]).toBe(
      "supportCaseStatusChangedNotice",
    );
    expect(JSON.stringify(changed)).not.toContain("usr_staff");
    expect(JSON.stringify(changed)).not.toContain("staff-private");
    expect(JSON.stringify(changed)).not.toContain("203.0.113.80");
    expect(JSON.stringify(changed)).not.toContain("resolved");
  });

  it("shows staff support replies to the requester without message body or staff network", () => {
    const reply = toSecurityActivityItem(
      {
        id: "aud_support_message",
        actorId: "usr_staff",
        action: "support.message.created",
        targetType: "support_case",
        ipAddress: "203.0.113.81",
        userAgent: "Staff Console",
        details: { authorRole: "staff", body: "private-staff-reply" },
        createdAt: new Date("2026-10-16T01:00:00.000Z"),
      },
      "usr_requester",
    );
    expect(reply).toEqual({
      id: "aud_support_message",
      action: "support.message.created",
      targetType: "support_case",
      perspective: "subject",
      createdAt: new Date("2026-10-16T01:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["support.message.created"]).toBe(
      "supportMessageCreatedNotice",
    );
    expect(JSON.stringify(reply)).not.toContain("private-staff-reply");
    expect(JSON.stringify(reply)).not.toContain("usr_staff");
    expect(JSON.stringify(reply)).not.toContain("203.0.113.81");
  });

  it("shows staff community-report decisions to the reporter without notes or staff network", () => {
    for (const [action, label] of [
      ["report.review", "reportReviewedNotice"],
      ["report.resolve", "reportResolvedNotice"],
      ["report.dismiss", "reportDismissedNotice"],
      ["report.remove_comment", "reportCommentRemovedNotice"],
    ] as const) {
      const item = toSecurityActivityItem(
        {
          id: `aud_${action}`,
          actorId: "usr_moderator",
          action,
          targetType: "report",
          ipAddress: "203.0.113.90",
          userAgent: "Moderator Console",
          details: { notes: "PRIVATE_MOD_NOTES", previousStatus: "open", status: "resolved" },
          createdAt: new Date("2026-10-18T00:00:00.000Z"),
        },
        "usr_reporter",
      );
      expect(item).toEqual({
        id: `aud_${action}`,
        action,
        targetType: "report",
        perspective: "subject",
        createdAt: new Date("2026-10-18T00:00:00.000Z"),
      });
      expect(SECURITY_SUBJECT_LABEL_KEYS[action]).toBe(label);
      expect(JSON.stringify(item)).not.toContain("PRIVATE_MOD_NOTES");
      expect(JSON.stringify(item)).not.toContain("usr_moderator");
      expect(JSON.stringify(item)).not.toContain("203.0.113.90");
    }
  });

  it("shows notified build quarantines to downloaders without reason or staff network", () => {
    const item = toSecurityActivityItem(
      {
        id: "aud_build_quarantine",
        actorId: "usr_moderator",
        action: "build.quarantined",
        targetType: "build",
        ipAddress: "203.0.113.91",
        userAgent: "Moderator Console",
        details: {
          reason: "PRIVATE_MALWARE_REASON",
          notifyAffectedDownloaders: true,
          version: "1.2.3",
        },
        createdAt: new Date("2026-10-19T00:00:00.000Z"),
      },
      "usr_downloader",
    );
    expect(item).toEqual({
      id: "aud_build_quarantine",
      action: "build.quarantined",
      targetType: "build",
      perspective: "subject",
      createdAt: new Date("2026-10-19T00:00:00.000Z"),
    });
    expect(SECURITY_SUBJECT_LABEL_KEYS["build.quarantined"]).toBe("buildQuarantinedNotice");
    expect(JSON.stringify(item)).not.toContain("PRIVATE_MALWARE_REASON");
    expect(JSON.stringify(item)).not.toContain("usr_moderator");
    expect(JSON.stringify(item)).not.toContain("203.0.113.91");
    expect(JSON.stringify(item)).not.toContain("1.2.3");
    expect(
      toSecurityActivityItem(
        {
          id: "aud_build_restore",
          actorId: "usr_moderator",
          action: "build.quarantine_restored",
          targetType: "build",
          createdAt: new Date("2026-10-19T01:00:00.000Z"),
        },
        "usr_downloader",
      ),
    ).toBeNull();
  });
});
