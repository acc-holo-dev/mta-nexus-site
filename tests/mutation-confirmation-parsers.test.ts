import { describe, expect, it } from "vitest";
import {
  confirmedNotificationPreferences,
  parseNotificationPreferences,
} from "../apps/web/src/lib/notification-preferences-confirmation";
import { confirmedCommentId } from "../apps/web/src/lib/content-comment-confirmation";
import {
  confirmsServerClaimVerification,
  parseIssuedServerClaimChallenge,
} from "../apps/web/src/lib/server-claim-confirmation";

const preferences = {
  followsEnabled: true,
  contentEnabled: false,
  serverEnabled: true,
  commerceEnabled: false,
  systemEnabled: true,
};

describe("mutation confirmation parsers", () => {
  it("accepts only complete canonical notification preferences", () => {
    expect(parseNotificationPreferences(preferences)).toEqual(preferences);
    expect(
      confirmedNotificationPreferences({
        success: true,
        preferences,
      }),
    ).toEqual(preferences);

    expect(
      confirmedNotificationPreferences({
        success: false,
        preferences,
      }),
    ).toBeNull();
    expect(
      parseNotificationPreferences({
        ...preferences,
        systemEnabled: "yes",
      }),
    ).toBeNull();
  });

  it("accepts only a successful response carrying a concrete comment id", () => {
    expect(
      confirmedCommentId(201, {
        comment: { id: "cmt_1", text: "Saved" },
      }),
    ).toBe("cmt_1");

    for (const [status, body] of [
      [500, { comment: { id: "cmt_1" } }],
      [201, null],
      [201, {}],
      [201, { comment: {} }],
      [201, { comment: { id: "" } }],
    ] as const) {
      expect(confirmedCommentId(status, body)).toBeNull();
    }
  });

  it("binds issued server-control challenges to the exact server", () => {
    const payload = {
      challenge: {
        challengeId: "scc_1",
        token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
        expiresAt: "2026-10-08T01:00:00.000Z",
        server: { id: "srv_1" },
      },
    };

    expect(
      parseIssuedServerClaimChallenge(201, payload, "srv_1"),
    ).toEqual({
      challengeId: "scc_1",
      token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
      expiresAt: "2026-10-08T01:00:00.000Z",
    });

    expect(
      parseIssuedServerClaimChallenge(201, payload, "srv_other"),
    ).toBeNull();
    expect(
      parseIssuedServerClaimChallenge(
        201,
        {
          challenge: {
            ...payload.challenge,
            token: "invalid-token",
          },
        },
        "srv_1",
      ),
    ).toBeNull();
  });

  it("confirms proof only for the exact challenge and proof method", () => {
    const payload = {
      success: true,
      verificationRequest: { id: "ver_1" },
      proof: {
        method: "mta_master_name_challenge",
        challengeId: "scc_1",
      },
    };

    expect(
      confirmsServerClaimVerification(201, payload, "scc_1"),
    ).toBe(true);
    expect(
      confirmsServerClaimVerification(201, payload, "scc_other"),
    ).toBe(false);
    expect(
      confirmsServerClaimVerification(
        201,
        {
          ...payload,
          proof: { method: "manual", challengeId: "scc_1" },
        },
        "scc_1",
      ),
    ).toBe(false);
    expect(
      confirmsServerClaimVerification(
        500,
        payload,
        "scc_1",
      ),
    ).toBe(false);
  });
});
