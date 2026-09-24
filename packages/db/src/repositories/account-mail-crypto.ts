import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from "node:crypto";
import type { KeyObject } from "node:crypto";

export type MailContext = Readonly<{
  id: string; challengeId: string; userId: string;
  purpose: "email_verify" | "password_reset"; expiresAt: Date;
}>;
export type MailPayload = Readonly<{ recipient: string; token: string }>;
export type SealedMail = Readonly<{
  version: 1; keyId: string; nonce: string; ciphertext: string; tag: string;
}>;
const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;

export class AccountMailKeyUnavailableError extends Error {
  constructor() {
    super("Account mail encryption key is unavailable");
    this.name = "AccountMailKeyUnavailableError";
  }
}

const invalid = () => new Error("Invalid account mail payload or key");

function decode(value: unknown, bytes?: number): Buffer {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048
    || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  const buffer = Buffer.from(value, "base64url");
  if (buffer.toString("base64url") !== value || (bytes !== undefined && buffer.length !== bytes)) throw invalid();
  return buffer;
}
function payload(value: unknown): MailPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const p = value as Record<string, unknown>;
  if (Object.keys(p).sort().join(",") !== "recipient,token"
    || typeof p.recipient !== "string" || Buffer.byteLength(p.recipient, "utf8") > 320
    || !/^[^\s@]+@[^\s@]+$/.test(p.recipient)) throw invalid();
  decode(p.token, 32);
  return { recipient: p.recipient, token: p.token as string };
}
function aad(context: MailContext, keyId: string): Buffer {
  if (![context.id, context.challengeId, context.userId].every((v) => typeof v === "string"
    && /^[A-Za-z0-9_-]{1,100}$/.test(v))
    || !["email_verify", "password_reset"].includes(context.purpose)
    || !(context.expiresAt instanceof Date) || !Number.isFinite(context.expiresAt.getTime())
    || !keyIdPattern.test(keyId)) throw invalid();
  return Buffer.from(JSON.stringify([
    "nexus:account-mail:v1", keyId, context.id, context.challengeId,
    context.userId, context.purpose, context.expiresAt.toISOString(),
  ]), "utf8");
}

// Explicit, server-internal key ring. No environment reads, defaults, AUTH_SECRET
// fallback or persisted keys. Keep old keys only for the approved rotation window.
export class AccountMailCipher {
  #activeKeyId: string;
  #keys = new Map<string, KeyObject>();
  constructor(activeKeyId: string, keys: Readonly<Record<string, Uint8Array>>) {
    if (!keyIdPattern.test(activeKeyId) || !keys || typeof keys !== "object") throw invalid();
    const entries = Object.entries(keys);
    if (entries.length === 0 || entries.length > 8) throw invalid();
    for (const [id, bytes] of entries) {
      if (!keyIdPattern.test(id) || !(bytes instanceof Uint8Array) || bytes.byteLength !== 32) throw invalid();
      this.#keys.set(id, createSecretKey(bytes));
    }
    if (!this.#keys.has(activeKeyId)) throw invalid();
    this.#activeKeyId = activeKeyId;
  }

  seal(context: MailContext, input: MailPayload): SealedMail {
    const keyId = this.#activeKeyId;
    const nonce = randomBytes(12);
    const plain = Buffer.from(JSON.stringify(payload(input)), "utf8");
    try {
      const cipher = createCipheriv("aes-256-gcm", this.#keys.get(keyId)!, nonce, { authTagLength: 16 });
      cipher.setAAD(aad(context, keyId));
      const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
      return Object.freeze({ version: 1, keyId, nonce: nonce.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") });
    } catch { throw invalid(); }
    finally { plain.fill(0); }
  }

  open(context: MailContext, value: unknown): MailPayload {
    let plain: Buffer | undefined;
    try {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
      const e = value as Record<string, unknown>;
      if (Object.keys(e).sort().join(",") !== "ciphertext,keyId,nonce,tag,version"
        || e.version !== 1 || typeof e.keyId !== "string" || !keyIdPattern.test(e.keyId)) throw invalid();
      const key = this.#keys.get(e.keyId);
      if (!key) throw new AccountMailKeyUnavailableError();
      const decipher = createDecipheriv("aes-256-gcm", key, decode(e.nonce, 12), { authTagLength: 16 });
      decipher.setAAD(aad(context, e.keyId));
      decipher.setAuthTag(decode(e.tag, 16));
      plain = Buffer.concat([decipher.update(decode(e.ciphertext)), decipher.final()]);
      if (plain.length > 1024) throw invalid();
      return Object.freeze(payload(JSON.parse(plain.toString("utf8"))));
    } catch (error) {
      if (error instanceof AccountMailKeyUnavailableError) throw error;
      throw invalid();
    } finally { plain?.fill(0); }
  }
}
