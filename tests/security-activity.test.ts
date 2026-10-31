import { SECURITY_SUBJECT_ACTIONS } from "@nexus/domain";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  isSecurityActivityAction,
  SECURITY_ACTIVITY_ACTIONS,
  SECURITY_ACTIVITY_LABEL_KEYS,
  SECURITY_SUBJECT_LABEL_KEYS,
  toSecurityActivityItem,
} from "../apps/web/src/lib/security-activity";

describe("security activity contract", () => {
  it("uses an explicit allowlist with a label for every action", () => {
    expect(new Set(SECURITY_ACTIVITY_ACTIONS).size).toBe(SECURITY_ACTIVITY_ACTIONS.length);
    for (const action of SECURITY_ACTIVITY_ACTIONS) {
      expect(isSecurityActivityAction(action)).toBe(true);
      expect(SECURITY_ACTIVITY_LABEL_KEYS[action]).toBeTruthy();
    }
    expect(isSecurityActivityAction("product.created")).toBe(false);
  });

  it("covers SEC-005 commerce, license, ownership and download actions", () => {
    const required = [
      "order.terms_recorded",
      "order.unpaid_cancelled",
      "commerce.subscription_expired",
      "commerce.subscription_activated_free",
      "commerce.subscription_cancelled",
      "commerce.order_case.created",
      "commerce.order_case.reviewed",
      "commerce.plan_review_saved",
      "support.case.created",
      "support.case.status_changed",
      "support.message.created",
      "resource.cart_acquired",
      "verification.application_updated",
      "user.privacy_updated",
      "verification.requested",
      "verification.approved",
      "verification.rejected",
      "server.control_proof_recorded",
      "server.verification_approved",
      "server.verification_rejected",
      "license.bound",
      "license.binding_refreshed",
      "license.token_rotated",
      "license.token_revoked",
      "license.revoked",
      "license.suspended",
      "license.restored",
      "license.expired",
      "license.expiring",
      "organization.ownership_transferred",
      "organization.member_added",
      "organization.member_updated",
      "organization.member_removed",
      "organization.member_left",
      "server.claim_challenge_issued",
      "product.download_started",
      "product.download_finished",
    ] as const;
    for (const action of required) {
      expect(SECURITY_ACTIVITY_ACTIONS).toContain(action);
      expect(isSecurityActivityAction(action)).toBe(true);
    }
    for (const action of SECURITY_SUBJECT_ACTIONS) {
      expect(SECURITY_ACTIVITY_ACTIONS).toContain(action);
      expect(SECURITY_SUBJECT_LABEL_KEYS[action]).toBeTruthy();
    }
  });

  it("keeps RU/EN Security Center labels for every allowlisted action", () => {
    for (const locale of ["en", "ru"] as const) {
      const labels = getDictionary(locale).securityCenter.activityLabels;
      for (const action of SECURITY_ACTIVITY_ACTIONS) {
        const key = SECURITY_ACTIVITY_LABEL_KEYS[action];
        expect(labels[key as keyof typeof labels]).toBeTruthy();
      }
      for (const key of Object.values(SECURITY_SUBJECT_LABEL_KEYS)) {
        expect(labels[key as keyof typeof labels]).toBeTruthy();
      }
    }
  });

  it("drops internal audit details from the user-facing item", () => {
    const source = {
      id: "aud_test",
      action: "user.password_changed",
      targetType: "user",
      ipAddress: "127.0.0.1",
      userAgent: "Browser",
      details: { email: "private@example.test", secret: "never expose" },
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    };
    const item = toSecurityActivityItem(source);
    expect(item).toEqual({
      id: "aud_test",
      action: "user.password_changed",
      targetType: "user",
      perspective: "actor",
      ipAddress: "127.0.0.1",
      userAgent: "Browser",
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(item).not.toHaveProperty("details");
  });

  it("maps license and ownership events without leaking audit details", () => {
    const license = toSecurityActivityItem({
      id: "aud_license",
      action: "license.bound",
      targetType: "license",
      details: { reason: "bind", previousStatus: "active" },
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(license).toEqual({
      id: "aud_license",
      action: "license.bound",
      targetType: "license",
      perspective: "actor",
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(JSON.stringify(license)).not.toContain("previousStatus");

    expect(
      toSecurityActivityItem({
        id: "aud_owner",
        action: "organization.ownership_transferred",
        targetType: "organization",
        createdAt: new Date("2026-10-07T00:00:00.000Z"),
      })?.action,
    ).toBe("organization.ownership_transferred");
  });

  it("maps buyer commerce audits without leaking order or subscription details", () => {
    const expired = toSecurityActivityItem({
      id: "aud_sub_expired",
      actorId: "usr_buyer",
      action: "commerce.subscription_expired",
      targetType: "subscription",
      details: { expiresAt: "2026-10-01T00:00:00.000Z" },
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(expired).toEqual({
      id: "aud_sub_expired",
      action: "commerce.subscription_expired",
      targetType: "subscription",
      perspective: "actor",
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(JSON.stringify(expired)).not.toContain("expiresAt");

    const orderCase = toSecurityActivityItem(
      {
        id: "aud_order_case",
        actorId: "usr_buyer",
        action: "commerce.order_case.created",
        targetType: "support_case",
        ipAddress: "198.51.100.20",
        userAgent: "Buyer Browser",
        details: {
          orderId: "ord_private",
          kind: "refund",
          toReview: "intake",
          notes: "staff-never",
        },
        createdAt: new Date("2026-10-07T01:00:00.000Z"),
      },
      "usr_buyer",
    );
    expect(orderCase).toEqual({
      id: "aud_order_case",
      action: "commerce.order_case.created",
      targetType: "support_case",
      perspective: "actor",
      ipAddress: "198.51.100.20",
      userAgent: "Buyer Browser",
      createdAt: new Date("2026-10-07T01:00:00.000Z"),
    });
    expect(JSON.stringify(orderCase)).not.toContain("ord_private");
    expect(JSON.stringify(orderCase)).not.toContain("staff-never");
    expect(JSON.stringify(orderCase)).not.toContain("toReview");
  });

  it("shows organization changes that name this account without the actor network or details", () => {
    const item = toSecurityActivityItem(
      {
        id: "aud_removed",
        actorId: "usr_admin",
        action: "organization.member_removed",
        targetType: "organization",
        ipAddress: "198.51.100.8",
        userAgent: "Staff Browser",
        details: { userId: "usr_member", note: "private-note" },
        createdAt: new Date("2026-10-07T00:00:00.000Z"),
      },
      "usr_member",
    );
    expect(item).toEqual({
      id: "aud_removed",
      action: "organization.member_removed",
      targetType: "organization",
      perspective: "subject",
      createdAt: new Date("2026-10-07T00:00:00.000Z"),
    });
    expect(JSON.stringify(item)).not.toContain("usr_admin");
    expect(JSON.stringify(item)).not.toContain("private-note");
    expect(JSON.stringify(item)).not.toContain("198.51.100.8");
    expect(
      toSecurityActivityItem(
        {
          id: "aud_foreign",
          actorId: "usr_admin",
          action: "user.logged_in",
          targetType: "user",
          createdAt: new Date("2026-10-07T00:00:00.000Z"),
        },
        "usr_member",
      ),
    ).toBeNull();
  });

  it("shows admin or system license actions for the owner without staff network or details", () => {
    const suspended = toSecurityActivityItem(
      {
        id: "aud_lic_suspend",
        actorId: "usr_staff",
        action: "license.suspended",
        targetType: "license",
        ipAddress: "203.0.113.9",
        userAgent: "Moderator",
        details: { userId: "usr_owner", reason: "staff-private", previousStatus: "active" },
        createdAt: new Date("2026-10-08T00:00:00.000Z"),
      },
      "usr_owner",
    );
    expect(suspended).toEqual({
      id: "aud_lic_suspend",
      action: "license.suspended",
      targetType: "license",
      perspective: "subject",
      createdAt: new Date("2026-10-08T00:00:00.000Z"),
    });
    expect(JSON.stringify(suspended)).not.toContain("usr_staff");
    expect(JSON.stringify(suspended)).not.toContain("staff-private");
    expect(JSON.stringify(suspended)).not.toContain("203.0.113.9");
    expect(
      toSecurityActivityItem(
        {
          id: "aud_lic_expired",
          actorId: "system:license-maintenance",
          action: "license.expired",
          targetType: "license",
          details: { userId: "usr_owner", notified: true },
          createdAt: new Date("2026-10-08T01:00:00.000Z"),
        },
        "usr_owner",
      ),
    ).toMatchObject({ perspective: "subject", action: "license.expired" });
  });

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

  it("maps plan-review saves without leaking plan or subject details", () => {
    const saved = toSecurityActivityItem({
      id: "aud_plan_review",
      actorId: "usr_seller",
      action: "commerce.plan_review_saved",
      targetType: "commercial_plan_review",
      details: {
        planId: "plan_private",
        revision: 3,
        subjectType: "user",
        subjectId: "usr_seller",
      },
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });
    expect(saved).toEqual({
      id: "aud_plan_review",
      action: "commerce.plan_review_saved",
      targetType: "commercial_plan_review",
      perspective: "actor",
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });
    expect(JSON.stringify(saved)).not.toContain("plan_private");
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

  it("maps subscription activate and cancel without leaking plan details", () => {
    const activated = toSecurityActivityItem({
      id: "aud_sub_free",
      actorId: "usr_buyer",
      action: "commerce.subscription_activated_free",
      targetType: "subscription",
      details: { planId: "plan_private", receiptId: "srec_private", price: 0 },
      createdAt: new Date("2026-10-13T01:00:00.000Z"),
    });
    expect(activated).toMatchObject({
      action: "commerce.subscription_activated_free",
      perspective: "actor",
    });
    expect(JSON.stringify(activated)).not.toContain("plan_private");
    expect(
      toSecurityActivityItem({
        id: "aud_sub_cancel",
        actorId: "usr_buyer",
        action: "commerce.subscription_cancelled",
        targetType: "subscription",
        details: { planId: "plan_private" },
        createdAt: new Date("2026-10-13T02:00:00.000Z"),
      })?.action,
    ).toBe("commerce.subscription_cancelled");
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

  it("maps cart acquisition, verification application updates and privacy changes without details", () => {
    expect(
      toSecurityActivityItem({
        id: "aud_cart",
        actorId: "usr_buyer",
        action: "resource.cart_acquired",
        targetType: "product",
        details: { productId: "prd_private" },
        createdAt: new Date("2026-10-16T02:00:00.000Z"),
      }),
    ).toMatchObject({ action: "resource.cart_acquired", perspective: "actor" });
    expect(
      toSecurityActivityItem({
        id: "aud_ver_app",
        actorId: "usr_requester",
        action: "verification.application_updated",
        targetType: "verification",
        details: { proofUrl: "https://private.example" },
        createdAt: new Date("2026-10-16T03:00:00.000Z"),
      }),
    ).toMatchObject({ action: "verification.application_updated", perspective: "actor" });
    const privacy = toSecurityActivityItem({
      id: "aud_privacy",
      actorId: "usr_owner",
      action: "user.privacy_updated",
      targetType: "user",
      details: { fields: ["showEmail"] },
      createdAt: new Date("2026-10-16T04:00:00.000Z"),
    });
    expect(privacy).toMatchObject({ action: "user.privacy_updated", perspective: "actor" });
    expect(JSON.stringify(privacy)).not.toContain("showEmail");
  });

  it("rejects non-security audit events", () => {
    expect(
      toSecurityActivityItem({
        id: "aud_other",
        action: "product.created",
        targetType: "product",
        createdAt: new Date(),
      }),
    ).toBeNull();
  });
});
