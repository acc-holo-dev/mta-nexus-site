import { describe, expect, it } from "vitest";
import { parseSupportIdempotencyKey, supportMutationFingerprint } from "../apps/web/src/lib/support-idempotency";

describe("support request idempotency contract", () => {
  const key = "12345678-1234-4234-8234-123456789abc";

  it("requires canonical v4 UUIDs as non-secret request keys", () => {
    expect(parseSupportIdempotencyKey(key)).toBe(key);
    for (const value of [
      null,
      "",
      "not-a-uuid",
      "12345678-1234-1234-8234-123456789abc",
      "12345678-1234-4234-0234-123456789abc",
      key.toUpperCase(),
      key + " ",
    ]) {
      expect(parseSupportIdempotencyKey(value)).toBeNull();
    }
  });

  it("fingerprints canonical request content and separates operations", () => {
    const input = {
      operation: "case" as const,
      category: "account",
      subject: "Help",
      message: "Please assist",
    };
    const digest = supportMutationFingerprint(input);
    expect(digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(supportMutationFingerprint({ ...input })).toBe(digest);
    expect(supportMutationFingerprint({ ...input, message: "Changed" })).not.toBe(digest);
    expect(supportMutationFingerprint({
      operation: "reply", caseId: "sup_case", message: "Please assist",
      expectedStatus: "open",
    })).not.toBe(digest);
  });

  it("binds reply retry identity to case, message and observed status", () => {
    const input = { operation: "reply" as const, caseId: "sup_test", message: "Help", expectedStatus: "open" };
    const digest = supportMutationFingerprint(input);
    expect(supportMutationFingerprint({ ...input })).toBe(digest);
    expect(supportMutationFingerprint({ ...input, caseId: "sup_other" })).not.toBe(digest);
    expect(supportMutationFingerprint({ ...input, expectedStatus: "resolved" })).not.toBe(digest);
  });
});
