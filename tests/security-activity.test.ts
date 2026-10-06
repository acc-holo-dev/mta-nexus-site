import { describe, expect, it } from "vitest";
import {
  SECURITY_ACTIVITY_ACTIONS,
  SECURITY_ACTIVITY_LABEL_KEYS,
  isSecurityActivityAction,
  toSecurityActivityItem,
} from "../apps/web/src/lib/security-activity";

describe("security activity contract", () => {
  it("uses an explicit allowlist with a label for every action", () => {
    expect(new Set(SECURITY_ACTIVITY_ACTIONS).size).toBe(
      SECURITY_ACTIVITY_ACTIONS.length,
    );
    for (const action of SECURITY_ACTIVITY_ACTIONS) {
      expect(isSecurityActivityAction(action)).toBe(true);
      expect(SECURITY_ACTIVITY_LABEL_KEYS[action]).toBeTruthy();
    }
    expect(isSecurityActivityAction("product.created")).toBe(false);
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

  it("rejects non-security audit events", () => {
    expect(toSecurityActivityItem({
      id: "aud_other",
      action: "product.created",
      targetType: "product",
      createdAt: new Date(),
    })).toBeNull();
  });
});
