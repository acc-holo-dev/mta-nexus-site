import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  createAccountMailDispatcher,
  createAccountMailProducerCipher,
  readAccountMailRuntimeConfig,
  readAccountRecoveryAbuseKey,
  runAccountMailLoop,
  runtimeFingerprint,
} from "./account-mail-runtime";

const key = randomBytes(32).toString("base64url");
const baseEnv = {
  ACCOUNT_MAIL_KEY_ID: "test",
  ACCOUNT_MAIL_KEY: key,
  ACCOUNT_MAIL_APP_URL: "https://nexus-mta.test",
  ACCOUNT_MAIL_SMTP_HOST: "smtp.test",
  ACCOUNT_MAIL_SMTP_SERVERNAME: "smtp.test",
  ACCOUNT_MAIL_SMTP_FROM: "no-reply@nexus-mta.test",
};

describe("D2d account mail runtime", () => {
  it("requires a dedicated 32-byte mail key and never falls back to AUTH_SECRET", () => {
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_KEY: undefined })).toThrow(
      "ACCOUNT_MAIL_KEY",
    );
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_KEY: "short" })).toThrow(
      "encryption key",
    );
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, AUTH_SECRET: key })).toThrow(
      "must not reuse AUTH_SECRET",
    );
  });

  it("requires a separate durable abuse-limit key without AUTH_SECRET fallback", () => {
    expect(() => readAccountRecoveryAbuseKey({})).toThrow("ACCOUNT_RECOVERY_ABUSE_KEY");
    expect(() => readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: "short" })).toThrow(
      "abuse key",
    );
    expect(() =>
      readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: key, AUTH_SECRET: key }),
    ).toThrow("must not reuse AUTH_SECRET");
    expect(readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: key })).toHaveLength(32);
  });

  it("requires an HTTPS application URL and explicit SMTP identity", () => {
    expect(() =>
      readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_APP_URL: "http://nexus-mta.test" }),
    ).toThrow();
    expect(() =>
      readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_SMTP_SERVERNAME: undefined }),
    ).toThrow();
    const config = readAccountMailRuntimeConfig(baseEnv);
    expect(config.smtpPort).toBe(465);
    expect(config.smtpTimeoutMs).toBe(5000);
    expect(config.batchSize).toBe(10);
  });

  it("requires SMTP authentication credentials as a pair and keeps them out of the fingerprint", () => {
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_SMTP_USERNAME: "ci-user",
      }),
    ).toThrow("username and password");
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_SMTP_PASSWORD: "ci-password",
      }),
    ).toThrow("username and password");
    const first = readAccountMailRuntimeConfig({
      ...baseEnv,
      ACCOUNT_MAIL_SMTP_USERNAME: "ci-user",
      ACCOUNT_MAIL_SMTP_PASSWORD: "ci-password-one",
    });
    const second = readAccountMailRuntimeConfig({
      ...baseEnv,
      ACCOUNT_MAIL_SMTP_USERNAME: "ci-user",
      ACCOUNT_MAIL_SMTP_PASSWORD: "ci-password-two",
    });
    expect(first.smtpUsername).toBe("ci-user");
    expect(first.smtpPassword).toBe("ci-password-one");
    expect(runtimeFingerprint(first)).toBe(runtimeFingerprint(second));
  });

  it.each(["http://localhost:3001", "http://127.0.0.1:3001", "http://[::1]:3001"])(
    "enables a local HTTP origin only in explicit development mode: %s",
    (appUrl) => {
      const config = readAccountMailRuntimeConfig({
        ...baseEnv,
        NODE_ENV: "development",
        ACCOUNT_MAIL_APP_URL: appUrl,
      });
      expect(config.appUrl).toBe(appUrl);
      expect(() => createAccountMailDispatcher(config)).not.toThrow();
      for (const NODE_ENV of [undefined, "test", "production"]) {
        expect(() =>
          readAccountMailRuntimeConfig({ ...baseEnv, NODE_ENV, ACCOUNT_MAIL_APP_URL: appUrl }),
        ).toThrow();
      }
    },
  );

  it.each([
    "http://nexus-mta.test",
    "http://localhost.evil.test",
    "http://192.168.1.2",
    "http://user:password@localhost:3000",
    "http://localhost:3000?token=x",
    "http://localhost:3000#token=x",
  ])("rejects non-local or decorated HTTP origins even in development: %s", (appUrl) => {
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        NODE_ENV: "development",
        ACCOUNT_MAIL_APP_URL: appUrl,
      }),
    ).toThrow();
  });

  it("supports one previous mail key for bounded rotation while producers stay on the active key", () => {
    const previousKey = randomBytes(32).toString("base64url");
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_PREVIOUS_KEY_ID: "old",
      }),
    ).toThrow("configured together");
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_PREVIOUS_KEY: previousKey,
      }),
    ).toThrow("configured together");
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_PREVIOUS_KEY_ID: "test",
        ACCOUNT_MAIL_PREVIOUS_KEY: previousKey,
      }),
    ).toThrow("identifier");
    expect(() =>
      readAccountMailRuntimeConfig({
        ...baseEnv,
        ACCOUNT_MAIL_PREVIOUS_KEY_ID: "old",
        ACCOUNT_MAIL_PREVIOUS_KEY: key,
      }),
    ).toThrow("must differ");

    const config = readAccountMailRuntimeConfig({
      ...baseEnv,
      ACCOUNT_MAIL_PREVIOUS_KEY_ID: "old",
      ACCOUNT_MAIL_PREVIOUS_KEY: previousKey,
    });
    expect(config.previousKeyId).toBe("old");
    expect(Object.keys(config.keys).sort()).toEqual(["old", "test"]);
    expect(runtimeFingerprint(config)).not.toBe(
      runtimeFingerprint(readAccountMailRuntimeConfig(baseEnv)),
    );

    const producer = createAccountMailProducerCipher({
      ...baseEnv,
      ACCOUNT_MAIL_PREVIOUS_KEY_ID: "old",
      ACCOUNT_MAIL_PREVIOUS_KEY: previousKey,
    });
    const sealed = producer.seal(
      {
        id: "ame_rotation_test",
        challengeId: "ach_rotation_test",
        userId: "usr_rotation_test",
        purpose: "email_verify",
        expiresAt: new Date("2026-09-25T00:00:00.000Z"),
      },
      {
        recipient: "rotation@example.invalid",
        token: randomBytes(32).toString("base64url"),
      },
    );
    expect(sealed.keyId).toBe("test");
  });

  it("runs exactly one bounded batch in once mode", async () => {
    const calls: number[] = [];
    const result = await runAccountMailLoop({
      dispatcher: {
        runBatch: async (limit) => {
          calls.push(limit ?? 0);
          return { accepted: 1, retried: 2, discarded: 3, skipped: 4, unsettled: 5, cleaned: 6 };
        },
      },
      signal: new AbortController().signal,
      batchSize: 7,
      pollIntervalMs: 100,
      once: true,
    });
    expect(calls).toEqual([7]);
    expect(result).toEqual({
      batches: 1,
      accepted: 1,
      retried: 2,
      discarded: 3,
      skipped: 4,
      unsettled: 5,
      cleaned: 6,
    });
  });

  it("stops between batches when aborted during the polling wait", async () => {
    const controller = new AbortController();
    let calls = 0;
    const promise = runAccountMailLoop({
      dispatcher: {
        runBatch: async () => {
          calls++;
          if (calls === 1) setTimeout(() => controller.abort(), 20);
          return { accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
        },
      },
      signal: controller.signal,
      batchSize: 1,
      pollIntervalMs: 1000,
    });
    const result = await promise;
    expect(calls).toBe(1);
    expect(result.batches).toBe(1);
  });

  it("does not start another batch after an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const result = await runAccountMailLoop({
      dispatcher: {
        runBatch: async () => {
          calls++;
          return { accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
        },
      },
      signal: controller.signal,
      batchSize: 1,
      pollIntervalMs: 100,
    });
    expect(calls).toBe(0);
    expect(result.batches).toBe(0);
  });
});
