import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { AccountMailCipher, AccountMailKeyUnavailableError } from "./account-mail-crypto";
import type { MailContext, MailPayload } from "./account-mail-crypto";
const fixture = () => {
  const key = randomBytes(32);
  const cipher = new AccountMailCipher("key_a", { key_a: key });
  const context: MailContext = { id: "ame_test", challengeId: "ach_test", userId: "usr_test",
    purpose: "email_verify", expiresAt: new Date("2026-09-25T00:00:00.000Z") };
  const payload = { recipient: "synthetic@example.invalid", token: randomBytes(32).toString("base64url") };
  return { key, cipher, context, payload };
};
function flip(value: string) {
  const bytes = Buffer.from(value, "base64url"); bytes[0] ^= 1; return bytes.toString("base64url");
}
const fails = (run: () => unknown) => assert.throws(run, /^Error: Invalid account mail payload or key$/);

describe("D2a authenticated account mail envelopes", () => {
  it("round-trips without putting recipient, proof or keys in the envelope", () => {
    const f = fixture(); const sealed = f.cipher.seal(f.context, f.payload);
    const opened = f.cipher.open(f.context, sealed);
    assert.equal(opened.token === f.payload.token && opened.recipient === f.payload.recipient, true);
    const diagnostic = JSON.stringify(sealed);
    assert.equal(diagnostic.includes(f.payload.token) || diagnostic.includes(f.payload.recipient), false);
    assert.equal(JSON.stringify(f.cipher), "{}");
  });
  it("uses a new random nonce even for the same payload and context", () => {
    const f = fixture(); const a = f.cipher.seal(f.context, f.payload); const b = f.cipher.seal(f.context, f.payload);
    assert.equal(a.nonce === b.nonce || a.ciphertext === b.ciphertext, false);
  });
  for (const field of ["nonce", "ciphertext", "tag"] as const) {
    it(`rejects modified ${field} before returning plaintext`, () => {
      const f = fixture(); const sealed = f.cipher.seal(f.context, f.payload);
      fails(() => f.cipher.open(f.context, { ...sealed, [field]: flip(sealed[field]) }));
    });
  }
  for (const field of ["id", "challengeId", "userId", "purpose", "expiresAt"] as const) {
    it(`authenticates ${field} so an envelope cannot be transplanted`, () => {
      const f = fixture(); const sealed = f.cipher.seal(f.context, f.payload);
      const changed = { ...f.context, [field]: field === "expiresAt"
        ? new Date(f.context.expiresAt.getTime() + 1) : field === "purpose" ? "password_reset" : "different_id" };
      fails(() => f.cipher.open(changed as MailContext, sealed));
    });
  }
  it("supports explicit key rotation and fails when the old key is absent", () => {
    const f = fixture(); const old = f.cipher.seal(f.context, f.payload); const nextKey = randomBytes(32);
    const next = new AccountMailCipher("key_b", { key_a: f.key, key_b: nextKey });
    assert.equal(next.open(f.context, old).token === f.payload.token, true);
    assert.equal(next.seal(f.context, f.payload).keyId, "key_b");
    assert.throws(
      () => new AccountMailCipher("key_b", { key_b: nextKey }).open(f.context, old),
      AccountMailKeyUnavailableError,
    );
    fails(() => new AccountMailCipher("key_a", { key_a: nextKey }).open(f.context, old));
  });
  it("authenticates key ID even when two IDs accidentally contain identical keys", () => {
    const f = fixture(); const ring = new AccountMailCipher("key_a", { key_a: f.key, key_b: f.key });
    const sealed = ring.seal(f.context, f.payload);
    fails(() => ring.open(f.context, { ...sealed, keyId: "key_b" }));
  });
  it("rejects malformed envelopes, truncated tags and oversized ciphertext", () => {
    const f = fixture(); const sealed = f.cipher.seal(f.context, f.payload);
    for (const value of [null, [], {}, { ...sealed, version: 2 }, { ...sealed, extra: true },
      { ...sealed, tag: "AA" }, { ...sealed, nonce: sealed.nonce + "=" },
      { ...sealed, ciphertext: "A".repeat(2049) }]) fails(() => f.cipher.open(f.context, value));
  });
  it("requires an explicit well-formed key ring without fallback", () => {
    fails(() => new AccountMailCipher("missing", {}));
    fails(() => new AccountMailCipher("missing", { key_a: randomBytes(32) }));
    fails(() => new AccountMailCipher("key_a", { key_a: randomBytes(31) }));
    fails(() => new AccountMailCipher("bad id", { "bad id": randomBytes(32) }));
  });
  it("rejects invalid or oversized recipients and noncanonical proof tokens", () => {
    const f = fixture();
    for (const value of [{ ...f.payload, recipient: "line\nbreak@example.invalid" },
      { ...f.payload, recipient: "x".repeat(321) + "@example.invalid" },
      { ...f.payload, token: "short" }, { ...f.payload, token: f.payload.token + "=" },
      { ...f.payload, password: "not-an-allowed-field" }]) {
      fails(() => f.cipher.seal(f.context, value as MailPayload));
    }
  });
});
