import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  confirmsServerClaimVerification,
  parseIssuedServerClaimChallenge,
} from "../apps/web/src/lib/server-claim-confirmation";

describe("server experience behavior", () => {
  it("accepts only a challenge bound to the requested server", () => {
    const payload = {
      challenge: {
        challengeId: "sch_1",
        token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
        expiresAt: "2026-10-08T12:00:00.000Z",
        server: { id: "srv_1" },
      },
    };

    expect(
      parseIssuedServerClaimChallenge(201, payload, "srv_1"),
    ).toEqual({
      challengeId: "sch_1",
      token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
      expiresAt: "2026-10-08T12:00:00.000Z",
    });

    expect(
      parseIssuedServerClaimChallenge(201, payload, "srv_other"),
    ).toBeNull();
    expect(
      parseIssuedServerClaimChallenge(500, payload, "srv_1"),
    ).toBeNull();
  });

  it("confirms ownership verification only for the issued challenge", () => {
    const payload = {
      success: true,
      verificationRequest: { id: "ver_1" },
      proof: {
        method: "mta_master_name_challenge",
        challengeId: "sch_1",
      },
    };

    expect(
      confirmsServerClaimVerification(200, payload, "sch_1"),
    ).toBe(true);
    expect(
      confirmsServerClaimVerification(200, payload, "sch_other"),
    ).toBe(false);
    expect(
      confirmsServerClaimVerification(409, payload, "sch_1"),
    ).toBe(false);
  });

  it("localizes history, update, follow, claim, and management surfaces", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.serverDetail.connect).not.toBe(ru.serverDetail.connect);
    expect(en.serverManagement.save).not.toBe(ru.serverManagement.save);
    expect(en.serverManagement.mapName).not.toBe(ru.serverManagement.mapName);
    expect(en.serverManagement.httpPort).not.toBe(ru.serverManagement.httpPort);
    expect(en.serverRegistration.mapName).not.toBe(ru.serverRegistration.mapName);
    expect(en.serverClaim.verify).not.toBe(ru.serverClaim.verify);
    expect(en.serverHistory.title).not.toBe(ru.serverHistory.title);
    expect(en.serverUpdates.title).not.toBe(ru.serverUpdates.title);
    expect(en.follow.follow).not.toBe(ru.follow.follow);
  });
});
