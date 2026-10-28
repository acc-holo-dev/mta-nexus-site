/** HTTP boundary only: no database, session lookup, or domain authorization. */
export type BrowserRequestDecision =
  | { allowed: true }
  | { allowed: false; status: 403 | 503; code: "CSRF_REJECTED" | "CSRF_CONFIG_INVALID" };

export function isSafeRequestMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

const LOCAL_DEVELOPMENT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "app",
  "nexus-local-app-1",
]);

/** Exact bearer-only routes. An Authorization header on any other route is no bypass. */
export function isLicenseRuntimeRequest(pathname: string): boolean {
  return pathname === "/api/licenses/check" || pathname === "/api/licenses/check-release";
}

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password)
      return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Production trusts a configured canonical origin, never Host or forwarded headers.
 * Development without a configured URL supports local browser/Compose hostnames.
 */
export function browserRequestDecision(
  request: Pick<Request, "method" | "headers" | "url">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): BrowserRequestDecision {
  if (isSafeRequestMethod(request.method)) return { allowed: true };

  const configured = env.NEXT_PUBLIC_APP_URL;
  const target = httpUrl(configured ?? (env.NODE_ENV === "production" ? "" : request.url));
  if (
    !target ||
    (configured !== undefined && (target.pathname !== "/" || target.search || target.hash)) ||
    (env.NODE_ENV === "production" && target.protocol !== "https:")
  ) {
    return { allowed: false, status: 503, code: "CSRF_CONFIG_INVALID" };
  }

  const reject = { allowed: false, status: 403, code: "CSRF_REJECTED" } as const;
  const site = request.headers.get("sec-fetch-site");
  // Sibling subdomains are not trusted, even when they receive SameSite cookies.
  if (site !== null && site !== "same-origin") return reject;

  const requestUrl = httpUrl(request.url);
  const localOrigin =
    env.NODE_ENV !== "production" &&
    target.protocol === "http:" &&
    LOCAL_DEVELOPMENT_HOSTS.has(target.hostname) &&
    requestUrl?.protocol === "http:" &&
    LOCAL_DEVELOPMENT_HOSTS.has(requestUrl.hostname) &&
    requestUrl.port === target.port
      ? requestUrl.origin
      : null;
  const trustedOrigin = (value: string) => value === target.origin || value === localOrigin;

  const origin = request.headers.get("origin");
  if (origin !== null) {
    // Literal comparison rejects null, multiple origins, credentials and paths.
    return trustedOrigin(origin) ? { allowed: true } : reject;
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    const source = httpUrl(referer);
    return source && trustedOrigin(source.origin) ? { allowed: true } : reject;
  }

  // Modern browsers can omit Origin/Referer but cannot forge Sec-Fetch-Site.
  return site === "same-origin" ? { allowed: true } : reject;
}
