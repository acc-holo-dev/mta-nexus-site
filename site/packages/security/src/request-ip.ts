import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

interface HeaderReader {
  get(name: string): string | null;
}

function trustedProxy(headers: HeaderReader, expectedSecret: string): boolean {
  if (
    typeof expectedSecret !== "string" ||
    expectedSecret.length < 32 ||
    expectedSecret.length > 512
  ) {
    throw new Error("Invalid trusted proxy secret");
  }
  const provided = headers.get("x-nexus-proxy-secret");
  if (!provided || provided.length !== expectedSecret.length || provided.length > 512) return false;
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expectedSecret, "utf8");
  // Equal JS string lengths do not guarantee equal UTF-8 byte lengths.
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}

export function getClientIp(headers: HeaderReader, expectedProxySecret: string): string {
  // Forwarded headers are authoritative only when the request passed through the
  // production reverse proxy, which overwrites the internal marker itself.
  if (!trustedProxy(headers, expectedProxySecret)) return "unknown";

  const realIp = headers.get("x-real-ip");
  const forwardedIp = headers.get("x-forwarded-for")?.split(",", 1)[0];
  const candidates = [realIp, forwardedIp];

  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized && isIP(normalized)) return normalized;
  }

  return "unknown";
}
