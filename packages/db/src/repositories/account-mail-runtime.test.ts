import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { readAccountMailRuntimeConfig, readAccountRecoveryAbuseKey, runAccountMailLoop } from "./account-mail-runtime";

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
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_KEY: undefined })).toThrow("ACCOUNT_MAIL_KEY");
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_KEY: "short" })).toThrow("encryption key");
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, AUTH_SECRET: key })).toThrow("must not reuse AUTH_SECRET");
  });

  it("requires a separate durable abuse-limit key without AUTH_SECRET fallback", () => {
    expect(() => readAccountRecoveryAbuseKey({})).toThrow("ACCOUNT_RECOVERY_ABUSE_KEY");
    expect(() => readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: "short" })).toThrow("abuse key");
    expect(() => readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: key, AUTH_SECRET: key })).toThrow("must not reuse AUTH_SECRET");
    expect(readAccountRecoveryAbuseKey({ ACCOUNT_RECOVERY_ABUSE_KEY: key })).toHaveLength(32);
  });

  it("requires an HTTPS application URL and explicit SMTP identity", () => {
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_APP_URL: "http://nexus-mta.test" })).toThrow();
    expect(() => readAccountMailRuntimeConfig({ ...baseEnv, ACCOUNT_MAIL_SMTP_SERVERNAME: undefined })).toThrow();
    const config = readAccountMailRuntimeConfig(baseEnv);
    expect(config.smtpPort).toBe(465);
    expect(config.smtpTimeoutMs).toBe(5000);
    expect(config.batchSize).toBe(10);
  });

  it("runs exactly one bounded batch in once mode", async () => {
    const calls: number[] = [];
    const result = await runAccountMailLoop({
      dispatcher: { runBatch: async (limit) => {
        calls.push(limit ?? 0);
        return { accepted: 1, retried: 2, discarded: 3, skipped: 4, unsettled: 5, cleaned: 6 };
      }},
      signal: new AbortController().signal, batchSize: 7, pollIntervalMs: 100, once: true,
    });
    expect(calls).toEqual([7]);
    expect(result).toEqual({ batches: 1, accepted: 1, retried: 2, discarded: 3, skipped: 4, unsettled: 5, cleaned: 6 });
  });

  it("stops between batches when aborted during the polling wait", async () => {
    const controller = new AbortController();
    let calls = 0;
    const promise = runAccountMailLoop({
      dispatcher: { runBatch: async () => {
        calls++;
        if (calls === 1) setTimeout(() => controller.abort(), 20);
        return { accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
      }},
      signal: controller.signal, batchSize: 1, pollIntervalMs: 1000,
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
      dispatcher: { runBatch: async () => {
        calls++;
        return { accepted: 0, retried: 0, discarded: 0, skipped: 0, unsettled: 0, cleaned: 0 };
      }},
      signal: controller.signal, batchSize: 1, pollIntervalMs: 100,
    });
    expect(calls).toBe(0);
    expect(result.batches).toBe(0);
  });
});
