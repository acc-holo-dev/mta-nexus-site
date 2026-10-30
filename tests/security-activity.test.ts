import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  isSecurityActivityAction,
  SECURITY_ACTIVITY_ACTIONS,
  SECURITY_ACTIVITY_LABEL_KEYS,
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
      "license.bound",
      "license.binding_refreshed",
      "license.token_rotated",
      "license.token_revoked",
      "license.revoked",
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
  });

  it("keeps RU/EN Security Center labels for every allowlisted action", () => {
    for (const locale of ["en", "ru"] as const) {
      const labels = getDictionary(locale).securityCenter.activityLabels;
      for (const action of SECURITY_ACTIVITY_ACTIONS) {
        const key = SECURITY_ACTIVITY_LABEL_KEYS[action];
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
