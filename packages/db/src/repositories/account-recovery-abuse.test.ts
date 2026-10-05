import { describe, expect, it } from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { AccountRecoveryAbuseLimitRepository } from "./account-recovery-abuse";

const repo = new AccountRecoveryAbuseLimitRepository();
const key = randomBytes(32);
const subject = () => `synthetic:${randomUUID()}`;
const subjectDigest = (scope: string, value: string) => createHmac("sha256", key)
  .update(`nexus:account-recovery-limit:v1:${scope}\0${value}`).digest("hex");

async function assertConcurrentWindow(
  value: string,
  results: Awaited<ReturnType<AccountRecoveryAbuseLimitRepository["consume"]>>[],
) {
  const allowed = results.filter((result) => result.success);
  const blocked = results.filter((result) => !result.success);
  expect(allowed).toHaveLength(3);
  expect(blocked).toHaveLength(results.length - 3);
  expect(allowed.map((result) => result.remaining).sort()).toEqual([0, 1, 2]);
  expect(blocked.every((result) => result.remaining === 0)).toBe(true);
  expect(new Set(results.map((result) => result.resetAt.toISOString())).size).toBe(1);
  const rows = await db.execute(sql`
    select "count", "expires_at"::text as "expires_at"
    from "account_recovery_abuse_limits"
    where "scope" = 'password_reset_request'
      and "subject_digest" = ${subjectDigest("password_reset_request", value)}
  `);
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].count)).toBe(3);
  expect(new Date(String(rows[0].expires_at)).toISOString()).toBe(results[0].resetAt.toISOString());
}

describe("D2d durable account recovery abuse limits", () => {
  it("persists a limit across repository instances without storing the raw subject", async () => {
    const value = subject();
    expect((await repo.consume({ scope: "password_reset_request", subject: value, key, limit: 2, windowSeconds: 60 })).success).toBe(true);
    const second = new AccountRecoveryAbuseLimitRepository();
    expect((await second.consume({ scope: "password_reset_request", subject: value, key, limit: 2, windowSeconds: 60 })).success).toBe(true);
    expect((await second.consume({ scope: "password_reset_request", subject: value, key, limit: 2, windowSeconds: 60 })).success).toBe(false);
    const rows = await db.execute(sql`select "subject_digest" from "account_recovery_abuse_limits" where "scope" = 'password_reset_request'`);
    expect(rows.some((row) => String(row.subject_digest).includes(value))).toBe(false);
  });

  it("separates scope and keyed subject identity", async () => {
    const value = subject();
    expect((await repo.consume({ scope: "password_reset_request", subject: value, key, limit: 1, windowSeconds: 60 })).success).toBe(true);
    expect((await repo.consume({ scope: "email_verify_request", subject: value, key, limit: 1, windowSeconds: 60 })).success).toBe(true);
    expect((await repo.consume({ scope: "password_reset_request", subject: value, key: randomBytes(32), limit: 1, windowSeconds: 60 })).success).toBe(true);
  });

  it("serializes concurrent attempts at the configured limit", async () => {
    const value = subject();
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      new AccountRecoveryAbuseLimitRepository().consume({
        scope: "password_reset_request", subject: value, key, limit: 3, windowSeconds: 60,
      })
    ));
    await assertConcurrentWindow(value, results);
  });

  it("resets an expired window only once across concurrent attempts", async () => {
    const value = subject();
    await repo.consume({ scope: "password_reset_request", subject: value, key, limit: 3, windowSeconds: 60 });
    const expiredAt = new Date(Date.now() - 1000);
    await db.execute(sql`
      update "account_recovery_abuse_limits"
      set "count" = 3,
          "expires_at" = ${expiredAt.toISOString()}::timestamptz,
          "window_started_at" = ${new Date(expiredAt.getTime() - 60000).toISOString()}::timestamptz
      where "scope" = 'password_reset_request'
        and "subject_digest" = ${subjectDigest("password_reset_request", value)}
    `);
    const results = await Promise.all(Array.from({ length: 8 }, () =>
      new AccountRecoveryAbuseLimitRepository().consume({
        scope: "password_reset_request", subject: value, key, limit: 3, windowSeconds: 60,
      })
    ));
    await assertConcurrentWindow(value, results);
    expect(results[0].resetAt.getTime()).toBeGreaterThan(expiredAt.getTime() + 60000);
  });

  it("resets an expired synthetic window and supports bounded cleanup", async () => {
    const value = subject();
    await repo.consume({ scope: "email_verify_request", subject: value, key, limit: 1, windowSeconds: 60 });
    await db.execute(sql`
      update "account_recovery_abuse_limits"
      set "expires_at" = clock_timestamp() - interval '1 second',
          "window_started_at" = clock_timestamp() - interval '61 seconds'
      where "scope" = 'email_verify_request'
    `);
    expect((await repo.consume({ scope: "email_verify_request", subject: value, key, limit: 1, windowSeconds: 60 })).success).toBe(true);

    const stale = subject();
    await repo.consume({ scope: "password_reset_request", subject: stale, key, limit: 1, windowSeconds: 60 });
    await db.execute(sql`
      update "account_recovery_abuse_limits"
      set "expires_at" = clock_timestamp() - interval '1 second',
          "window_started_at" = clock_timestamp() - interval '61 seconds'
      where "scope" = 'password_reset_request'
    `);
    expect(await repo.cleanup(1)).toBe(1);
  });

  it("rejects invalid policy and key inputs", async () => {
    await expect(repo.consume({ scope: "password_reset_request", subject: subject(), key: new Uint8Array(4), limit: 1, windowSeconds: 60 })).rejects.toThrow();
    await expect(repo.consume({ scope: "password_reset_request", subject: subject(), key, limit: 0, windowSeconds: 60 })).rejects.toThrow();
    await expect(repo.cleanup(101)).rejects.toThrow();
  });
});
