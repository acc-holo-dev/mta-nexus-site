import { describe, expect, it } from "vitest";
import { confirmsFollowMutation } from "../apps/web/src/lib/follow-confirmation";

describe("follow read-your-write confirmation", () => {
  const target = { targetType: "server", targetId: "srv_123" };

  it.each([
    [200, { success: true, ...target, following: true }, true, true],
    [200, { success: true, ...target, following: false }, false, true],
    [409, { ...target, following: true }, true, true],
    [409, { ...target, following: false }, true, false],
    [409, { error: "Already following" }, true, false],
    [
      200,
      { success: true, targetType: "server", targetId: "srv_other", following: true },
      true,
      false,
    ],
    [200, { success: true, ...target, following: false }, true, false],
    [503, { ...target, following: true }, true, false],
    [200, null, true, false],
  ])(
    "status %i and payload %j for desired follow=%s confirms=%s",
    (status, payload, expected, confirmed) => {
      expect(
        confirmsFollowMutation(status, payload, target.targetType, target.targetId, expected),
      ).toBe(confirmed);
    },
  );
});
