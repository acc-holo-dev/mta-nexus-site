import { Buffer } from "node:buffer";
import { createECDH } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Placeholder subject; replace before production use. */
export const DEFAULT_WEB_PUSH_VAPID_SUBJECT = "mailto:ops@example.invalid";

/**
 * P-256 VAPID key pair using the same encoding rules as `@nexus/config` validation.
 */
export function generateWebPushVapidKeyPair() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  // OpenSSL can omit leading zero bytes; VAPID requires a 32-byte scalar.
  const scalar = ecdh.getPrivateKey();
  const privateKeyBuffer = Buffer.alloc(32);
  scalar.copy(privateKeyBuffer, privateKeyBuffer.length - scalar.length);
  return {
    publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
    privateKey: privateKeyBuffer.toString("base64url"),
  };
}

export function formatWebPushVapidEnvLines({ publicKey, privateKey, subject }) {
  const resolvedSubject = subject?.trim() || DEFAULT_WEB_PUSH_VAPID_SUBJECT;
  return [
    `WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey}`,
    `WEB_PUSH_VAPID_PRIVATE_KEY=${privateKey}`,
    `WEB_PUSH_VAPID_SUBJECT=${resolvedSubject}`,
  ];
}

export function generateWebPushVapidEnvLines(subject = DEFAULT_WEB_PUSH_VAPID_SUBJECT) {
  const pair = generateWebPushVapidKeyPair();
  return formatWebPushVapidEnvLines({ ...pair, subject });
}

const scriptPath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(scriptPath).href
) {
  const subject = process.argv[2]?.trim() || DEFAULT_WEB_PUSH_VAPID_SUBJECT;
  for (const line of generateWebPushVapidEnvLines(subject)) {
    console.log(line);
  }
}
