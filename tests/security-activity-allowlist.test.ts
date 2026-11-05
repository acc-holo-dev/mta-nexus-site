import { SECURITY_SUBJECT_ACTIONS } from "@nexus/domain";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  isSecurityActivityAction,
  SECURITY_ACTIVITY_ACTIONS,
  SECURITY_ACTIVITY_LABEL_KEYS,
  SECURITY_SUBJECT_LABEL_KEYS,
  toSecurityActivityItem,
} from "./helpers/security-activity-harness";

describe("security activity allowlist and projection basics", () => {
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
