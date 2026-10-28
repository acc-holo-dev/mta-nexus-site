import { describe, expect, it } from "vitest";
import {
  buildVerificationDecisionPayload,
  normalizeVerificationReviewNotes,
} from "../apps/web/src/lib/verification-moderation";

describe("verification moderation client contract", () => {
  it("normalizes review notes inside the same 3..2000 character boundary as the API", () => {
    expect(normalizeVerificationReviewNotes("  valid note  ")).toBe("valid note");
    expect(normalizeVerificationReviewNotes("ab")).toBeNull();
    expect(normalizeVerificationReviewNotes("x".repeat(2000))).toBe("x".repeat(2000));
    expect(normalizeVerificationReviewNotes("x".repeat(2001))).toBeNull();
  });

  it("builds the canonical shared admin action payload", () => {
    expect(buildVerificationDecisionPayload(" ver_1 ", "approve", "  verified evidence  ")).toEqual(
      {
        targetType: "verification",
        targetId: "ver_1",
        action: "approve",
        notes: "verified evidence",
      },
    );
  });

  it("fails closed for empty or unbounded target ids", () => {
    expect(buildVerificationDecisionPayload("", "reject", "valid notes")).toBeNull();
    expect(buildVerificationDecisionPayload("x".repeat(129), "reject", "valid notes")).toBeNull();
  });
});
