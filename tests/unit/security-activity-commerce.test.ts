import { describe, expect, it } from "vitest";
import { toSecurityActivityItem } from "../helpers/security-activity-harness";

describe("security activity commerce cart subscription and plan-review projection", () => {
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
});
