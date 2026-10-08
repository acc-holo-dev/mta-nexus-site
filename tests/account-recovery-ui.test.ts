import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  parseAccountRecoveryLocation,
  recoveryJsonRequest,
} from "../apps/web/src/lib/account-recovery-browser";
import {
  PASSWORD_RESET_NEUTRAL_RESPONSE,
  PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS,
  PASSWORD_RESET_REQUEST_FLOOR_MIN_MS,
  passwordResetRemainingFloorMs,
  passwordResetTargetMs,
  waitForPasswordResetFloor,
} from "../apps/web/src/lib/account-recovery-request-policy";

const validChallenge = "ach_recovery_fixture";
const validToken = "A".repeat(43);

describe("account recovery browser policy", () => {
  it("parses a valid proof and returns a history-safe path", () => {
    expect(
      parseAccountRecoveryLocation(
        `https://nexus.test/auth/reset-password?challenge=${validChallenge}#token=${validToken}`,
      ),
    ).toEqual({
      proof: { challengeId: validChallenge, token: validToken },
      scrubbedPath: "/auth/reset-password",
    });
  });

  it.each([
    "https://nexus.test/auth/reset-password",
    `https://nexus.test/auth/reset-password?challenge=bad#token=${validToken}`,
    `https://nexus.test/auth/reset-password?challenge=${validChallenge}#token=short`,
    "not-a-url",
  ])("rejects malformed proof input: %s", (href) => {
    expect(parseAccountRecoveryLocation(href).proof).toBeNull();
  });

  it("builds no-store same-origin JSON requests", () => {
    const init = recoveryJsonRequest("PATCH", {
      challengeId: validChallenge,
      token: validToken,
    });
    expect(init).toMatchObject({
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
    });
    expect(init.body).toBe(
      JSON.stringify({
        challengeId: validChallenge,
        token: validToken,
      }),
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("password-reset request timing policy", () => {
  it("keeps the public response account-neutral", () => {
    expect(PASSWORD_RESET_NEUTRAL_RESPONSE.accepted).toBe(true);
    expect(PASSWORD_RESET_NEUTRAL_RESPONSE.message).toBe(
      "If an eligible account uses that email, a password reset link will be sent.",
    );
  });

  it("bounds randomized response-floor targets", () => {
    expect(passwordResetTargetMs(0)).toBe(PASSWORD_RESET_REQUEST_FLOOR_MIN_MS);
    expect(passwordResetTargetMs(PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS)).toBe(
      PASSWORD_RESET_REQUEST_FLOOR_MIN_MS +
        PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS,
    );
    expect(() => passwordResetTargetMs(-1)).toThrow(
      "Invalid password-reset timing jitter",
    );
  });

  it("waits only for the remaining floor duration", async () => {
    expect(passwordResetRemainingFloorMs(100, 900, 450)).toBe(550);
    expect(passwordResetRemainingFloorMs(100, 900, 1_100)).toBe(0);

    const sleep = vi.fn(async () => undefined);
    await waitForPasswordResetFloor(100, 900, {
      now: () => 450,
      sleep,
    });
    expect(sleep).toHaveBeenCalledWith(550);

    sleep.mockClear();
    await waitForPasswordResetFloor(100, 900, {
      now: () => 1_100,
      sleep,
    });
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("account recovery localization", () => {
  it("provides distinct RU and EN copy for the complete journey", () => {
    const en = getDictionary("en").recovery;
    const ru = getDictionary("ru").recovery;
    expect(en.forgotTitle).not.toBe(ru.forgotTitle);
    expect(en.resetTitle).not.toBe(ru.resetTitle);
    expect(en.verifyTitle).not.toBe(ru.verifyTitle);
    expect(en.resetSuccess).not.toBe(ru.resetSuccess);
  });
});
