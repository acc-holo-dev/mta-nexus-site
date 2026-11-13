import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { db } from "../../site/packages/db/src/client";

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives: migration", () => {
  it("rehearses the additive migration with existing users/sessions and trusts no legacy flag", async () => {
    const schema = `d1_${randomUUID().replaceAll("-", "")}`;
    const migration = readFileSync(
      resolve(process.cwd(), "site/packages/db/migrations/0012_account_recovery_proofs.sql"),
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(
        sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`,
      );
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      await tx.execute(
        sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'unchanged-hash', true)`,
      );
      await tx.execute(
        sql`INSERT INTO sessions VALUES ('legacy-session', 'legacy', 'unchanged-digest')`,
      );
      for (const part of migration.split("--> statement-breakpoint")) {
        if (part.trim()) await tx.execute(sql.raw(part));
      }
      const legacy = await tx.execute(sql`SELECT * FROM users`);
      expect(legacy[0]).toMatchObject({
        id: "legacy",
        email: "legacy@example.invalid",
        password_hash: "unchanged-hash",
        email_verified: true,
      });
      const oldSessions = await tx.execute(sql`SELECT * FROM sessions`);
      expect(oldSessions).toHaveLength(1);
      expect(oldSessions[0].token === "unchanged-digest").toBe(true);
      for (const table of ["account_auth_state", "account_recovery_bindings", "auth_challenges"]) {
        expect((await tx.execute(sql.raw(`SELECT * FROM "${table}"`))).length).toBe(0);
      }
      await tx.execute(
        sql`UPDATE users SET password_hash = 'new-synthetic-hash' WHERE id = 'legacy'`,
      );
      const state = await tx.execute(
        sql`SELECT credential_version FROM account_auth_state WHERE user_id = 'legacy'`,
      );
      expect(state[0].credential_version).toBe(1);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });
});
