import { describe, expect, it } from "vitest";
import { toSecurityActivityItem } from "../helpers/security-activity-harness";

describe("security activity license and ownership projection", () => {
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
});
