import { type NextRequest, NextResponse } from "next/server";
import { rejectUnsafeBrowserRequest } from "./lib/browser-request-guard";
import { isLicenseRuntimeRequest } from "./lib/browser-request-policy";
import {
  appendVaryHeader,
  isOfflineCacheablePublicPath,
  PUBLIC_OFFLINE_CACHE_HEADER,
  PUBLIC_OFFLINE_CACHE_MARKER,
} from "./lib/offline-cache-policy";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !isLicenseRuntimeRequest(request.nextUrl.pathname)
  ) {
    const rejected = rejectUnsafeBrowserRequest(request);
    if (rejected) return rejected;
  }
  const response = NextResponse.next();

  if (
    request.method !== "GET" ||
    request.cookies.has("nexus_session") ||
    !isOfflineCacheablePublicPath(request.nextUrl.pathname)
  ) {
    return response;
  }

  response.headers.set(PUBLIC_OFFLINE_CACHE_HEADER, PUBLIC_OFFLINE_CACHE_MARKER);
  // App Router may replace Proxy Vary with RSC fields; production Caddy
  // re-attaches Cookie on proxied responses (deploy/Caddyfile).
  response.headers.set("Vary", appendVaryHeader(response.headers.get("Vary"), "Cookie"));

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/articles/:path*",
    "/community-rules",
    "/copyright",
    "/privacy",
    "/terms",
  ],
};
