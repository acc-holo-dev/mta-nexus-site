export const SESSION_COOKIE_NAME = "nexus_session";

/** Keep issuance, rotation and deletion on the same host-only cookie scope. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * SameSite=Lax sends this cookie on a cross-site top-level GET. That navigation
 * must not become a download receipt or audit. Same-origin fetches still may.
 */
export function isCrossSiteTopLevelDownload(request: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("sec-fetch-site") !== "cross-site") return false;
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  if (mode === "cors" || mode === "no-cors" || mode === "same-origin" || mode === "websocket") {
    return false;
  }
  return mode === "navigate" || dest === "document" || (mode === null && dest === null);
}

/** Drop only the session cookie so a cross-site download cannot authorize with it. */
export function cookieHeaderWithoutSession(header: string | null): string | null {
  if (!header) return null;
  const kept = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(`${SESSION_COOKIE_NAME}=`));
  return kept.length > 0 ? kept.join("; ") : null;
}
