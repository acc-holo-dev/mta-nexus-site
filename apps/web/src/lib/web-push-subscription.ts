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

export function parseWebPushSubscription(value: unknown): ParsedWebPushSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const endpoint = boundedString(record.endpoint, 2048);
  const keys =
    record.keys && typeof record.keys === "object" && !Array.isArray(record.keys)
      ? (record.keys as Record<string, unknown>)
      : null;
  const p256dh = boundedString(keys?.p256dh, 512);
  const auth = boundedString(keys?.auth, 512);
  if (!endpoint || !p256dh || !auth) return null;

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
    if (typeof expirationTime !== "number" || !Number.isFinite(expirationTime) || expirationTime <= 0) return null;
    expirationAt = new Date(expirationTime);
    if (Number.isNaN(expirationAt.getTime())) return null;
  }

  return { endpoint: endpointUrl.toString(), expirationAt, p256dh, auth };
}
