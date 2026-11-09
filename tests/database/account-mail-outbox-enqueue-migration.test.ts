import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { describe, it } from "vitest";
import { authService } from "../../apps/web/src/lib/services/auth-service";
import { db } from "../../packages/db/src/client";
import type { MailContext, MailPayload } from "../../packages/db/src/repositories/account-mail-crypto";
import { AccountMailCipher } from "../../packages/db/src/repositories/account-mail-crypto";
import { userRepository } from "../../packages/db/src/repositories/users";
import {
  account,
  cipher,
  digestAccountChallenge,
  exists,
  issued,
  key,
  mail,
  pending,
  postgresCode,
  queue,
  settled,
  verification,
} from "../helpers/account-mail-outbox-harness";

describe("D2a atomic encrypted mail enqueue: migration and enqueue", () => {
  it("applies the additive migration without creating mail for old proofs or changing users", async () => {
    const schema = `d2_${randomUUID().replaceAll("-", "")}`;
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(
        sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`,
      );
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      for (const name of ["0012_account_recovery_proofs.sql"]) {
        for (const part of readFileSync(
          resolve(process.cwd(), "packages/db/migrations", name),
          "utf8",
        ).split("--> statement-breakpoint")) {
          if (part.trim()) await tx.execute(sql.raw(part));
        }
      }
      await tx.execute(
        sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'same-hash', false)`,
      );
      await tx.execute(
        sql`INSERT INTO sessions VALUES ('legacy-session', 'legacy', 'same-digest')`,
      );
      await tx.execute(sql`INSERT INTO auth_challenges
        (id,user_id,purpose,token_digest,email,credential_version,initiating_session_digest,expires_at)
        VALUES ('legacy-proof','legacy','email_verify',repeat('a',64),'legacy@example.invalid',0,repeat('b',64),now()+interval '1 hour')`);
      const migration = readFileSync(
        resolve(process.cwd(), "packages/db/migrations/0013_account_mail_outbox.sql"),
        "utf8",
      );
      for (const part of migration.split("--> statement-breakpoint"))
        if (part.trim()) await tx.execute(sql.raw(part));
      const [u] = await tx.execute(sql`SELECT * FROM users`);
      assert.equal(u.password_hash === "same-hash" && u.email_verified === false, true);
      assert.equal((await tx.execute(sql`SELECT * FROM sessions`)).length, 1);
      assert.equal((await tx.execute(sql`SELECT * FROM account_mail_outbox`)).length, 0);
      const [p] = await tx.execute(sql`SELECT * FROM auth_challenges`);
      assert.equal(p.id, "legacy-proof");
      assert.equal(p.revoked_at, null);
      assert.equal(p.consumed_at, null);
      const [g] = await tx.execute(sql`SELECT capacity FROM account_mail_queue_gate`);
      assert.equal(g.capacity, 1000);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });

  it("commits the proof, safe audit and encrypted envelope together without returning secrets", async () => {
    const a = await account();
    const result = await queue.enqueue(verification(a), cipher);
    const m = await mail(result.id);
    assert.equal(m.decoded.recipient === a.input.email, true);
    assert.equal(
      digestAccountChallenge("email_verify", m.decoded.token) === m.proof.tokenDigest,
      true,
    );
    assert.equal(m.mail.expiresAt.getTime(), m.proof.expiresAt.getTime());
    assert.equal(m.proof.expiresAt.getTime() - m.proof.createdAt.getTime(), 24 * 60 * 60_000);
    assert.deepEqual(Object.keys(result).sort(), ["challengeId", "expiresAt", "id"]);
    const audits = await issued(a);
    assert.equal(audits.length, 1);
    const exposed = JSON.stringify([result, m.mail, audits]);
    assert.equal(
      exposed.includes(m.decoded.token) ||
        exposed.includes(a.currentToken) ||
        exposed.includes(a.input.email),
      false,
    );
    assert.equal((await authService.getSession(a.currentToken))?.id, a.userId);
    assert.equal(
      (await userRepository.findByEmail(a.input.email))?.passwordHash === a.expectedPasswordHash,
      true,
    );
  });

  it("can read persisted ciphertext with a new key ring without generating another proof", async () => {
    const a = await account();
    const result = await queue.enqueue(verification(a), cipher);
    const m = await mail(result.id);
    const fresh = new AccountMailCipher("next_key", { d2_test: key, next_key: randomBytes(32) });
    assert.equal(fresh.open(m.context, m.mail.payload).token === m.decoded.token, true);
    assert.equal((await pending(a)).length, 1);
    assert.equal((await issued(a)).length, 1);
  });

  it("rolls back proof and audit when the database rejects an oversized queue envelope", async () => {
    const a = await account();
    const first = await queue.enqueue(verification(a), cipher);
    class OversizedEnvelope extends AccountMailCipher {
      override seal(context: MailContext, input: MailPayload) {
        const envelope = super.seal(context, input);
        return { ...envelope, ciphertext: envelope.ciphertext.repeat(30) };
      }
    }
    // Explicit fault injection in the cipher result; the 23514 database failure is real.
    const failure = await settled(
      queue.enqueue(verification(a), new OversizedEnvelope("d2_test", { d2_test: key })),
    );
    assert.equal(failure.ok, false);
    if (!failure.ok) assert.equal(postgresCode(failure.error), "23514");
    assert.equal(await exists(first.id), true);
    assert.equal((await pending(a))[0].id, first.challengeId);
    assert.equal((await issued(a)).length, 1);
  });
});
