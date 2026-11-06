import { Buffer } from "node:buffer";
import { createECDH } from "node:crypto";

/** Minimal accepted production env base for focused config suites. */
export const configProductionBase = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://nexus:secret@db.example.com:5432/nexus",
  AUTH_SECRET: "a-production-secret-with-at-least-32-characters",
  STORAGE_PROVIDER: "local",
  STORAGE_LOCAL_PATH: "/data/uploads",
  EMAIL_PROVIDER: "disabled",
  BUILD_SCANNER: "clamav",
  CLAMAV_HOST: "clamav",
} as const;

/** Generate a matching Web Push VAPID key pair for config suites. */
export function createConfigVapidKeyPair() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  // OpenSSL can omit leading zero bytes; VAPID requires a 32-byte scalar.
  const scalar = ecdh.getPrivateKey();
  const privateKey = Buffer.alloc(32);
  scalar.copy(privateKey, privateKey.length - scalar.length);
  return {
    publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
    privateKey: privateKey.toString("base64url"),
  };
}
