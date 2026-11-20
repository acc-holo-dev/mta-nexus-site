type AuthMode = "login" | "register";

const AUTH_RETURN_FALLBACK = "/workspace";
const AUTH_RETURN_MAX_LENGTH = 2048;

/**
 * Accept only same-app relative paths (optional query/hash).
 * External URLs, protocol-relative targets, and auth loops are rejected.
 */
export function parseAuthReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > AUTH_RETURN_MAX_LENGTH) return null;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  try {
    const base = new URL("https://nexus.invalid/");
    const target = new URL(trimmed, base);
    if (target.origin !== base.origin) return null;
    if (target.pathname === "/auth/login" || target.pathname === "/auth/register") return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function resolveAuthReturnPath(value: unknown): string {
  return parseAuthReturnPath(value) ?? AUTH_RETURN_FALLBACK;
}

export function authEntryHref(mode: AuthMode, returnPath?: string | null): string {
  const base = mode === "login" ? "/auth/login" : "/auth/register";
  const safe = parseAuthReturnPath(returnPath);
  if (!safe) return base;
  return `${base}?next=${encodeURIComponent(safe)}`;
}

export function currentBrowserReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  return parseAuthReturnPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}
