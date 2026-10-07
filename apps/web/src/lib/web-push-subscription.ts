export type ParsedWebPushSubscription = {
  endpoint: string;
  expirationAt: Date | null;
  p256dh: string;
  auth: string;
};

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/gu, "+").replace(/_/gu, "/");

  try {
    const raw = atob(base64);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isUncompressedP256Key(value: string): boolean {
  const decoded = decodeBase64Url(value);
  return decoded?.length === 65 && decoded[0] === 0x04;
}

function isAuthSecret(value: string): boolean {
  return decodeBase64Url(value)?.length === 16;
}

export function parseWebPushVapidPublicKey(value: unknown): string | null {
  const key = boundedString(value, 128);
  return key && isUncompressedP256Key(key) ? key : null;
}

export function parseWebPushSubscription(
  value: unknown,
): ParsedWebPushSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const endpoint = boundedString(record.endpoint, 2048);
  const keys =
    record.keys && typeof record.keys === "object" && !Array.isArray(record.keys)
      ? (record.keys as Record<string, unknown>)
      : null;
  const p256dh = boundedString(keys?.p256dh, 128);
  const auth = boundedString(keys?.auth, 64);

  if (
    !endpoint ||
    !p256dh ||
    !auth ||
    !isUncompressedP256Key(p256dh) ||
    !isAuthSecret(auth)
  ) {
    return null;
  }

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return null;
  }
  if (endpointUrl.protocol !== "https:") return null;

  const expirationTime = record.expirationTime;
  let expirationAt: Date | null = null;
  if (expirationTime !== null && expirationTime !== undefined) {
    if (
      typeof expirationTime !== "number" ||
      !Number.isFinite(expirationTime) ||
      expirationTime <= 0
    ) {
      return null;
    }
    expirationAt = new Date(expirationTime);
    if (Number.isNaN(expirationAt.getTime())) return null;
  }

  return {
    endpoint: endpointUrl.toString(),
    expirationAt,
    p256dh,
    auth,
  };
}
