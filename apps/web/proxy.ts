import { type NextRequest, NextResponse } from "next/server";
import {
  appendVaryHeader,
  isOfflineCacheablePublicPath,
  PUBLIC_OFFLINE_CACHE_HEADER,
  PUBLIC_OFFLINE_CACHE_MARKER,
} from "./src/lib/offline-cache-policy";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (
    request.method !== "GET" ||
    request.cookies.has("nexus_session") ||
    !isOfflineCacheablePublicPath(request.nextUrl.pathname)
  ) {
    return response;
  }

  response.headers.set(
    PUBLIC_OFFLINE_CACHE_HEADER,
    PUBLIC_OFFLINE_CACHE_MARKER,
  );
  response.headers.set(
    "Vary",
    appendVaryHeader(response.headers.get("Vary"), "Cookie"),
  );

  return response;
}

export const config = {
  matcher: [
    "/articles/:path*",
    "/copyright",
    "/privacy",
    "/terms",
  ],
};
