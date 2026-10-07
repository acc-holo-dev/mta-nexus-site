import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign as signJwt,
} from "node:crypto";
import type { WebPushVapidConfig } from "@nexus/config";
import {
  isValidWebPushAuthSecret,
  isValidWebPushP256PublicKey,
} from "@nexus/config";

const DEFAULT_RECORD_SIZE = 4096;
const WEB_PUSH_INFO = Buffer.from("WebPush: info", "ascii");
const CEK_INFO = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
const NONCE_INFO = Buffer.from("Content-Encoding: nonce\0", "ascii");

export type WebPushEncryptionSubscription = {
  p256dh: string;
  auth: string;
};

export type WebPushEncryptionOptions = {
  recordSize?: number;
  salt?: Uint8Array;
  senderPrivateKey?: Uint8Array;
};

export type VapidAuthorization = {
  audience: string;
  expiresAt: number;
  token: string;
  header: string;
};

function hmacSha256(
  key: Uint8Array,
  ...parts: Uint8Array[]
): Buffer {
  const hmac = createHmac("sha256", key);
  for (const part of parts) hmac.update(part);
  return hmac.digest();
}

function hkdfExpandSingle(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Buffer {
  if (!Number.isInteger(length) || length < 1 || length > 32) {
    throw new RangeError("Single-block HKDF length must be between 1 and 32");
  }
  return hmacSha256(prk, info, Uint8Array.of(1)).subarray(0, length);
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function encryptWebPushMessage(
  subscription: WebPushEncryptionSubscription,
  plaintext: Uint8Array,
  options: WebPushEncryptionOptions = {},
): Buffer {
  if (!isValidWebPushP256PublicKey(subscription.p256dh)) {
    throw new Error("Invalid Web Push receiver public key");
  }
  if (!isValidWebPushAuthSecret(subscription.auth)) {
    throw new Error("Invalid Web Push authentication secret");
  }

  const recordSize = options.recordSize ?? DEFAULT_RECORD_SIZE;
  if (
    !Number.isInteger(recordSize) ||
    recordSize < 18 ||
    recordSize > 0xffff_ffff
  ) {
    throw new RangeError("Invalid aes128gcm record size");
  }

  const payload = Buffer.from(plaintext);
  if (payload.length + 1 + 16 >= recordSize) {
    throw new RangeError("Web Push payload does not fit one encrypted record");
  }

  const salt = options.salt
    ? Buffer.from(options.salt)
    : randomBytes(16);
  if (salt.length !== 16) {
    throw new RangeError("Web Push salt must be exactly 16 bytes");
  }

  const receiverPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const sender = createECDH("prime256v1");
  if (options.senderPrivateKey) {
    const privateKey = Buffer.from(options.senderPrivateKey);
    if (privateKey.length !== 32) {
      throw new RangeError("Web Push sender private key must be 32 bytes");
    }
    sender.setPrivateKey(privateKey);
  } else {
    sender.generateKeys();
  }

  const senderPublic = sender.getPublicKey(undefined, "uncompressed");
  const sharedSecret = sender.computeSecret(receiverPublic);

  const authenticationPrk = hmacSha256(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    WEB_PUSH_INFO,
    Uint8Array.of(0),
    receiverPublic,
    senderPublic,
  ]);
  const inputKeyMaterial = hkdfExpandSingle(
    authenticationPrk,
    keyInfo,
    32,
  );

  const contentPrk = hmacSha256(salt, inputKeyMaterial);
  const contentEncryptionKey = hkdfExpandSingle(contentPrk, CEK_INFO, 16);
  const nonce = hkdfExpandSingle(contentPrk, NONCE_INFO, 12);

  const cipher = createCipheriv(
    "aes-128-gcm",
    contentEncryptionKey,
    nonce,
  );
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([payload, Uint8Array.of(0x02)])),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const header = Buffer.allocUnsafe(21);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header[20] = senderPublic.length;

  return Buffer.concat([
    header,
    senderPublic,
    ciphertext,
    tag,
  ]);
}

export function createVapidAuthorization(
  endpoint: string,
  config: WebPushVapidConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): VapidAuthorization {
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== "https:") {
    throw new Error("Web Push endpoint must use HTTPS");
  }
  if (!Number.isInteger(nowSeconds) || nowSeconds <= 0) {
    throw new RangeError("Invalid VAPID timestamp");
  }

  const publicKey = decodeBase64Url(config.publicKey);
  const privateKey = decodeBase64Url(config.privateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: publicKey.subarray(1, 33).toString("base64url"),
    y: publicKey.subarray(33, 65).toString("base64url"),
    d: privateKey.toString("base64url"),
  };
  const signingKey = createPrivateKey({
    key: jwk,
    format: "jwk",
  });

  const expiresAt = nowSeconds + 12 * 60 * 60;
  const encodedHeader = base64UrlJson({
    typ: "JWT",
    alg: "ES256",
  });
  const encodedClaims = base64UrlJson({
    aud: endpointUrl.origin,
    exp: expiresAt,
    sub: config.subject,
  });
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = signJwt(
    "sha256",
    Buffer.from(signingInput, "ascii"),
    {
      key: signingKey,
      dsaEncoding: "ieee-p1363",
    },
  ).toString("base64url");
  const token = `${signingInput}.${signature}`;

  return {
    audience: endpointUrl.origin,
    expiresAt,
    token,
    header: `vapid t=${token}, k=${config.publicKey}`,
  };
}
