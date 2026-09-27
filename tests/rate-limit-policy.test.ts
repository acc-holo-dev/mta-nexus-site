import { describe, expect, it } from "vitest";
import { getRateLimitPolicy, RATE_LIMIT_POLICIES } from "@nexus/security";

describe("risk-based rate limit policy", () => {
  it("defines bounded policies for every protected mutation category", () => {
    expect(Object.keys(RATE_LIMIT_POLICIES)).toEqual([
      "authLogin",
      "authRegistration",
      "buildUpload",
      "download",
      "follow",
      "report",
      "sessionManagement",
      "passwordChange",
      "notificationMutation",
      "resourceClaim",
      "resourceInspection",
      "verification",
      "moderationAction",
      "serverMutation",
      "serverClaimProof",
      "contentCreation",
      "commentCreation",
      "reviewSubmission",
      "search",
    ]);

    for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
      expect(policy.limit).toBeGreaterThan(0);
      expect(policy.windowSeconds).toBeGreaterThan(0);
    }
  });

  it("keeps high-volume download traffic separate from abuse-prone mutations", () => {
    expect(getRateLimitPolicy("download")).toEqual({ limit: 30, windowSeconds: 60 });
    expect(getRateLimitPolicy("report")).toEqual({ limit: 10, windowSeconds: 3600 });
    expect(getRateLimitPolicy("follow")).toEqual({ limit: 30, windowSeconds: 60 });
    expect(getRateLimitPolicy("sessionManagement")).toEqual({ limit: 20, windowSeconds: 300 });
    expect(getRateLimitPolicy("passwordChange")).toEqual({ limit: 5, windowSeconds: 3600 });
    expect(getRateLimitPolicy("notificationMutation")).toEqual({ limit: 30, windowSeconds: 60 });
    expect(getRateLimitPolicy("resourceClaim")).toEqual({ limit: 20, windowSeconds: 60 });
    expect(getRateLimitPolicy("resourceInspection")).toEqual({ limit: 30, windowSeconds: 60 });
    expect(getRateLimitPolicy("verification")).toEqual({ limit: 3, windowSeconds: 86400 });
    expect(getRateLimitPolicy("moderationAction")).toEqual({ limit: 60, windowSeconds: 60 });
    expect(getRateLimitPolicy("serverMutation")).toEqual({ limit: 20, windowSeconds: 3600 });
    expect(getRateLimitPolicy("serverClaimProof")).toEqual({ limit: 12, windowSeconds: 900 });
    expect(getRateLimitPolicy("contentCreation")).toEqual({ limit: 20, windowSeconds: 3600 });
    expect(getRateLimitPolicy("commentCreation")).toEqual({ limit: 20, windowSeconds: 300 });
    expect(getRateLimitPolicy("reviewSubmission")).toEqual({ limit: 5, windowSeconds: 300 });
    expect(getRateLimitPolicy("search")).toEqual({ limit: 60, windowSeconds: 60 });
  });
});
