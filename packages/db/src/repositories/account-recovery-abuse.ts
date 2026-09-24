import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../client";

export type AccountRecoveryAbuseScope = "email_verify_request" | "password_reset_request";

function digest(scope: AccountRecoveryAbuseScope, subject: string, key: Uint8Array): string {
  if (!["email_verify_request", "password_reset_request"].includes(scope)
    || typeof subject !== "string" || subject.length < 1 || subject.length > 512
    || !(key instanceof Uint8Array) || key.byteLength !== 32) {
    throw new Error("Invalid account recovery abuse-limit input");
  }
  return createHmac("sha256", key)
    .update(`nexus:account-recovery-limit:v1:${scope}\0${subject}`)
    .digest("hex");
}

export class AccountRecoveryAbuseLimitRepository {
  async consume(input: {
    scope: AccountRecoveryAbuseScope;
    subject: string;
    key: Uint8Array;
    limit: number;
    windowSeconds: number;
  }): Promise<{ success: boolean; remaining: number; resetAt: Date }> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 1000
      || !Number.isInteger(input.windowSeconds) || input.windowSeconds < 1 || input.windowSeconds > 604800) {
      throw new Error("Invalid account recovery abuse-limit policy");
    }
    const subjectDigest = digest(input.scope, input.subject, input.key);
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [clock] = await tx.execute(sql`select clock_timestamp()::text as now`);
      const now = new Date(String(clock.now));
      const rows = await tx.execute(sql`
        select "count", "expires_at"::text as "expires_at"
        from "account_recovery_abuse_limits"
        where "scope" = ${input.scope} and "subject_digest" = ${subjectDigest}
        for update
      `);
      const row = rows[0] as { count: number; expires_at: string } | undefined;
      if (!row || new Date(row.expires_at) <= now) {
        const resetAt = new Date(now.getTime() + input.windowSeconds * 1000);
        await tx.execute(sql`
          insert into "account_recovery_abuse_limits"
            ("scope","subject_digest","count","window_started_at","expires_at")
          values (${input.scope}, ${subjectDigest}, 1, ${now}, ${resetAt})
          on conflict ("scope","subject_digest") do update
          set "count" = 1, "window_started_at" = excluded."window_started_at",
              "expires_at" = excluded."expires_at"
        `);
        return { success: true, remaining: input.limit - 1, resetAt };
      }
      const count = Number(row.count);
      const resetAt = new Date(row.expires_at);
      if (count >= input.limit) return { success: false, remaining: 0, resetAt };
      await tx.execute(sql`
        update "account_recovery_abuse_limits"
        set "count" = "count" + 1
        where "scope" = ${input.scope} and "subject_digest" = ${subjectDigest}
      `);
      return { success: true, remaining: input.limit - count - 1, resetAt };
    }, { isolationLevel: "read committed" });
  }

  async cleanup(limit = 100): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Invalid abuse-limit cleanup limit");
    }
    return db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        select "scope", "subject_digest"
        from "account_recovery_abuse_limits"
        where "expires_at" <= clock_timestamp()
        order by "expires_at", "scope", "subject_digest"
        limit ${limit}
        for update skip locked
      `);
      let removed = 0;
      for (const row of rows as Array<{ scope: string; subject_digest: string }>) {
        const deleted = await tx.execute(sql`
          delete from "account_recovery_abuse_limits"
          where "scope" = ${row.scope}
            and "subject_digest" = ${row.subject_digest}
            and "expires_at" <= clock_timestamp()
          returning "scope"
        `);
        removed += deleted.length;
      }
      return removed;
    });
  }
}
export const accountRecoveryAbuseLimitRepository = new AccountRecoveryAbuseLimitRepository();
