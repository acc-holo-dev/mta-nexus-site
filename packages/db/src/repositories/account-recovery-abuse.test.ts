import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { AccountRecoveryAbuseLimitRepository } from "./account-recovery-abuse";

const repo = new AccountRecoveryAbuseLimitRepository();
const key = randomBytes(32);
const subject = () => `synthetic:${randomUUID()}`;

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
    expect(results.filter((result) => result.success)).toHaveLength(3);
    expect(results.filter((result) => !result.success)).toHaveLength(3);
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
