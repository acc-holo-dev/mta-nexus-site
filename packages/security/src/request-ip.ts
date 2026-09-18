import { isIP } from "node:net";

interface HeaderReader {
  get(name: string): string | null;
}

export function getClientIp(headers: HeaderReader): string {
  const realIp = headers.get("x-real-ip");
  const forwardedIp = headers.get("x-forwarded-for")?.split(",", 1)[0];
  const candidates = [realIp, forwardedIp];

  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized && isIP(normalized)) return normalized;
  }

  return "unknown";
}
