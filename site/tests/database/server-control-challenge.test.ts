import { describe, expect, it } from "vitest";
import { digestServerClaimToken, serverClaimChallengePolicy } from "@nexus/db";

describe("server control challenge token contract", () => {
  it("accepts the public token format and stores a one-way digest", () => {
    const token = "NXCLAIM-0123456789ABCDEF01234567";
    const digest = digestServerClaimToken(token);

    expect(digest).toMatch(/^[0-9a-f]{64}$/u);
    expect(digest).not.toContain(token);
    expect(serverClaimChallengePolicy.lifetimeMs).toBe(10 * 60_000);
  });

  it("rejects malformed tokens before database lookup", () => {
    for (const token of [
      "",
      "nxclaim-0123456789ABCDEF01234567",
      "NXCLAIM-short",
      "NXCLAIM-0123456789ABCDEF0123456G",
    ]) {
      expect(() => digestServerClaimToken(token)).toThrow(
        /Invalid or expired server control challenge/u,
      );
    }
  });
});
