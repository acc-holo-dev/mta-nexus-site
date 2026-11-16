import type { NextRequest } from "next/server";
import { getClientIp } from "@nexus/security";

export function getTrustedRequestIp(request: NextRequest): string {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return "local-direct";
    throw new Error("Trusted proxy secret is unavailable");
  }
  return getClientIp(request.headers, secret);
}
