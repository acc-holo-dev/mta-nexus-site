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
      "commerce.order_case.created",
      "commerce.order_case.reviewed",
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
