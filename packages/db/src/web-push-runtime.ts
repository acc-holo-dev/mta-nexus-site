import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign as signJwt,
} from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import type { WebPushVapidConfig } from "@nexus/config";
import {
  isValidWebPushAuthSecret,
  isValidWebPushP256PublicKey,
} from "@nexus/config";

const DEFAULT_RECORD_SIZE = 4096;
const MAX_WEB_PUSH_BODY_BYTES = 4096;
const AES128GCM_HEADER_FIXED_BYTES = 21;
const AES_GCM_TAG_BYTES = 16;
const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_TIMEOUT_MS = 10_000;
const WEB_PUSH_INFO = Buffer.from("WebPush: info", "ascii");
const CEK_INFO = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
const NONCE_INFO = Buffer.from("Content-Encoding: nonce\0", "ascii");

export type WebPushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type WebPushSendResult = {
  statusCode: number;
};

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

export type WebPushResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type WebPushHostResolver = (
  hostname: string,
) => Promise<WebPushResolvedAddress[]>;

export type WebPushHttpsRequest = {
  body: Buffer;
  connectAddress: string;
  family: 4 | 6;
  headers: Record<string, string>;
  path: string;
  port: number;
  servername: string;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type WebPushHttpsTransport = (
  request: WebPushHttpsRequest,
) => Promise<WebPushSendResult>;

export type WebPushSendOptions = {
  signal?: AbortSignal;
};

export type WebPushSender = (
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: WebPushNotificationPayload,
  options?: WebPushSendOptions,
) => Promise<WebPushSendResult>;

const RESERVED_ADDRESSES = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  RESERVED_ADDRESSES.addSubnet(address, prefix, "ipv4");
}

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  RESERVED_ADDRESSES.addSubnet(address, prefix, "ipv6");
}

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
    throw new RangeError(
      "Single-block HKDF length must be between 1 and 32",
    );
  }
  return hmacSha256(prk, info, Uint8Array.of(1)).subarray(
    0,
    length,
  );
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
}

function normalizedHostname(url: URL): string {
  return url.hostname
    .replace(/^\[/u, "")
    .replace(/\]$/u, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

function boundedText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function safeNotificationTarget(value: unknown): string | undefined {
  const bounded = boundedText(value, 2048);
  if (
    !bounded ||
    !bounded.startsWith("/") ||
    bounded.startsWith("//")
  ) {
    return undefined;
  }
  try {
    const base = new URL("https://nexus.invalid/");
    const target = new URL(bounded, base);
    if (target.origin !== base.origin) return undefined;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return undefined;
  }
}

export function normalizeWebPushPayload(
  value: WebPushNotificationPayload,
): WebPushNotificationPayload {
  const url = safeNotificationTarget(value.url);
  const tag = boundedText(value.tag, 120);
  return {
    title: boundedText(value.title, 120) ?? "MTA NEXUS",
    body:
      boundedText(value.body, 280) ??
      "You have a new notification.",
    ...(url ? { url } : {}),
    ...(tag ? { tag } : {}),
  };
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
  if (payload.length + 1 + AES_GCM_TAG_BYTES >= recordSize) {
    throw new RangeError(
      "Web Push payload does not fit one encrypted record",
    );
  }

  const salt = options.salt
    ? Buffer.from(options.salt)
    : randomBytes(16);
  if (salt.length !== 16) {
    throw new RangeError(
      "Web Push salt must be exactly 16 bytes",
    );
  }

  const receiverPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const sender = createECDH("prime256v1");
  if (options.senderPrivateKey) {
    const privateKey = Buffer.from(options.senderPrivateKey);
    if (privateKey.length !== 32) {
      throw new RangeError(
        "Web Push sender private key must be 32 bytes",
      );
    }
    sender.setPrivateKey(privateKey);
  } else {
    sender.generateKeys();
  }

  const senderPublic = sender.getPublicKey(
    undefined,
    "uncompressed",
  );
  const encryptedBodySize =
    AES128GCM_HEADER_FIXED_BYTES +
    senderPublic.length +
    payload.length +
    1 +
    AES_GCM_TAG_BYTES;
  if (encryptedBodySize > MAX_WEB_PUSH_BODY_BYTES) {
    throw new RangeError(
      "Web Push encrypted body exceeds 4096 bytes",
    );
  }

  const sharedSecret = sender.computeSecret(receiverPublic);
  const authenticationPrk = hmacSha256(
    authSecret,
    sharedSecret,
  );
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
  const contentEncryptionKey = hkdfExpandSingle(
    contentPrk,
    CEK_INFO,
    16,
  );
  const nonce = hkdfExpandSingle(contentPrk, NONCE_INFO, 12);

  const cipher = createCipheriv(
    "aes-128-gcm",
    contentEncryptionKey,
    nonce,
  );
  const ciphertext = Buffer.concat([
    cipher.update(
      Buffer.concat([payload, Uint8Array.of(0x02)]),
    ),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const header = Buffer.allocUnsafe(
    AES128GCM_HEADER_FIXED_BYTES,
  );
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

export function parseWebPushEndpoint(value: string): URL {
  const endpoint = value.trim();
  if (!endpoint || endpoint.length > 2048) {
    throw new Error("Invalid Web Push endpoint");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid Web Push endpoint");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Unsafe Web Push endpoint");
  }

  const hostname = normalizedHostname(url);
  if (
    !hostname ||
    hostname.length > 253 ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isIP(hostname) !== 0
  ) {
    throw new Error("Unsafe Web Push endpoint");
  }

  return url;
}

export function isPublicWebPushAddress(
  address: string,
): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (
    family === 6 &&
    address.toLowerCase().startsWith("::ffff:")
  ) {
    return false;
  }
  return !RESERVED_ADDRESSES.check(
    address,
    family === 4 ? "ipv4" : "ipv6",
  );
}

export const systemWebPushHostResolver: WebPushHostResolver =
  async (hostname) => {
    const records = await dnsLookup(hostname, {
      all: true,
      verbatim: true,
    });
    return records
      .filter(
        (
          record,
        ): record is { address: string; family: 4 | 6 } =>
          record.family === 4 || record.family === 6,
      )
      .map((record) => ({
        address: record.address,
        family: record.family,
      }));
  };

export async function resolveWebPushTarget(
  endpoint: string,
  resolver: WebPushHostResolver = systemWebPushHostResolver,
): Promise<{
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
}> {
  const url = parseWebPushEndpoint(endpoint);
  const hostname = normalizedHostname(url);
  const records = await resolver(hostname);

  if (
    !records.length ||
    records.some(
      (record) =>
        isIP(record.address) !== record.family ||
        !isPublicWebPushAddress(record.address),
    )
  ) {
    throw new Error(
      "Web Push endpoint did not resolve exclusively to public addresses",
    );
  }

  const [selected] = records;
  if (!selected) {
    throw new Error("Web Push endpoint resolution failed");
  }

  return {
    url,
    hostname,
    address: selected.address,
    family: selected.family,
  };
}

export type PreparedWebPushRequest = {
  body: Buffer;
  headers: Record<string, string>;
  url: URL;
};

export function prepareWebPushRequest(
  endpoint: string,
  subscription: {
    p256dh: string;
    auth: string;
  },
  payload: WebPushNotificationPayload,
  config: WebPushVapidConfig,
  options: {
    ttlSeconds?: number;
    nowSeconds?: number;
  } = {},
): PreparedWebPushRequest {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 0 ||
    ttlSeconds > 2_147_483_648
  ) {
    throw new RangeError("Invalid Web Push TTL");
  }

  const url = parseWebPushEndpoint(endpoint);
  const body = encryptWebPushMessage(
    subscription,
    Buffer.from(
      JSON.stringify(normalizeWebPushPayload(payload)),
      "utf8",
    ),
  );
  const authorization = createVapidAuthorization(
    endpoint,
    config,
    options.nowSeconds,
  );

  return {
    body,
    url,
    headers: {
      Authorization: authorization.header,
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
    },
  };
}

export const sendWebPushHttpsRequest: WebPushHttpsTransport =
  async (prepared) =>
    await new Promise<WebPushSendResult>(
      (resolve, reject) => {
        const request = httpsRequest(
          {
            protocol: "https:",
            hostname: prepared.connectAddress,
            family: prepared.family,
            port: prepared.port,
            servername: prepared.servername,
            path: prepared.path,
            method: "POST",
            headers: prepared.headers,
            rejectUnauthorized: true,
            signal: prepared.signal
              ? AbortSignal.any([
                  prepared.signal,
                  AbortSignal.timeout(prepared.timeoutMs),
                ])
              : AbortSignal.timeout(prepared.timeoutMs),
          },
          (response) => {
            const statusCode = response.statusCode ?? 0;
            response.destroy();
            resolve({ statusCode });
          },
        );

        request.once("error", reject);
        request.end(prepared.body);
      },
    );

export function createWebPushHttpSender(
  config: WebPushVapidConfig,
  options: {
    resolver?: WebPushHostResolver;
    transport?: WebPushHttpsTransport;
    timeoutMs?: number;
    ttlSeconds?: number;
    nowSeconds?: () => number;
  } = {},
): WebPushSender {
  const resolver =
    options.resolver ?? systemWebPushHostResolver;
  const transport =
    options.transport ?? sendWebPushHttpsRequest;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 250 ||
    timeoutMs > 60_000
  ) {
    throw new RangeError("Invalid Web Push timeout");
  }

  return async (subscription, payload, sendOptions) => {
    const target = await resolveWebPushTarget(
      subscription.endpoint,
      resolver,
    );
    const prepared = prepareWebPushRequest(
      target.url.toString(),
      subscription,
      payload,
      config,
      {
        ttlSeconds: options.ttlSeconds,
        nowSeconds: options.nowSeconds?.(),
      },
    );

    return await transport({
      body: prepared.body,
      connectAddress: target.address,
      family: target.family,
      headers: {
        ...prepared.headers,
        Host: target.url.host,
      },
      path: `${target.url.pathname}${target.url.search}`,
      port: 443,
      servername: target.hostname,
      timeoutMs,
      signal: sendOptions?.signal,
    });
  };
}
