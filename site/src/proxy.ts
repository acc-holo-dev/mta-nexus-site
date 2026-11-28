import { type NextRequest, NextResponse } from "next/server";
import {
  cookieHeaderWithoutSession,
  isCrossSiteTopLevelDownload,
} from "./features/accounts/session-cookie";
import {
  appendVaryHeader,
  isOfflineCacheablePublicPath,
  PUBLIC_OFFLINE_CACHE_HEADER,
  PUBLIC_OFFLINE_CACHE_MARKER,
} from "./features/shell/offline-cache-policy";
import { rejectUnsafeBrowserRequest } from "./lib/http/browser-request-guard";
import { isMachineApiRequest } from "./lib/http/browser-request-policy";

const STATE_CHANGING_DOWNLOAD = /^\/api\/(?:products\/[^/]+|admin\/builds\/[^/]+)\/download$/u;

function continueRequest(request: NextRequest) {
  if (
    !STATE_CHANGING_DOWNLOAD.test(request.nextUrl.pathname) ||
    !isCrossSiteTopLevelDownload(request)
  ) {
    return NextResponse.next();
  }
  const headers = new Headers(request.headers);
  const cookie = cookieHeaderWithoutSession(headers.get("cookie"));
  if (cookie) headers.set("cookie", cookie);
  else headers.delete("cookie");
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    !isMachineApiRequest(request.nextUrl.pathname)
  ) {
    const rejected = rejectUnsafeBrowserRequest(request);
    if (rejected) return rejected;
  }
  const response = continueRequest(request);

  if (
    request.method !== "GET" ||
    request.cookies.has("nexus_session") ||
    !isOfflineCacheablePublicPath(request.nextUrl.pathname)
  ) {
    return response;
  }

  response.headers.set(PUBLIC_OFFLINE_CACHE_HEADER, PUBLIC_OFFLINE_CACHE_MARKER);
  // App Router may replace Proxy Vary with RSC fields; production Caddy
  // re-attaches Cookie on proxied responses (docker/Caddyfile).
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
