import { describe, expect, it } from "vitest";
import { confirmsAdminAction } from "../apps/web/src/lib/admin-action-confirmation";

describe("admin mutation confirmation", () => {
  const body = {
    success: true,
    targetId: "target_1",
    action: "approve",
  };

  it("accepts only a matching successful command response", () => {
    expect(
      confirmsAdminAction(
        200,
        body,
        "target_1",
        "approve",
      ),
    ).toBe(true);
  });

  it.each([
    [199, body],
    [300, body],
    [200, null],
    [200, {}],
    [200, { ...body, success: false }],
    [200, { ...body, targetId: "target_2" }],
    [200, { ...body, action: "reject" }],
  ])("rejects ambiguous or unrelated result %#", (status, value) => {
    expect(
      confirmsAdminAction(
        status as number,
        value,
        "target_1",
        "approve",
      ),
    ).toBe(false);
  });
});
