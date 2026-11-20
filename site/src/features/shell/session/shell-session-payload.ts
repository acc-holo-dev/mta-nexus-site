import type { ShellAuthSession } from "./shell-destination-policy";

type SessionResponse =
  | { authenticated: false; user: null }
  | { authenticated: true; user: { id: string; username: string; role: string | null } };

/** An invalid response is unknown, not evidence that the visitor is signed out. */
export function parseSessionResponse(data: unknown): SessionResponse | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as {
    authenticated?: unknown;
    user?: { id?: unknown; username?: unknown; role?: unknown } | null;
  };
  if (payload.authenticated === false && payload.user === null) {
    return { authenticated: false, user: null };
  }
  if (payload.authenticated !== true || !payload.user || typeof payload.user !== "object") {
    return null;
  }
  const { id, username, role } = payload.user;
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 128 ||
    id.trim() !== id ||
    typeof username !== "string" ||
    !username ||
    username.trim() !== username
  )
    return null;
  return {
    authenticated: true,
    user: { id, username, role: typeof role === "string" ? role : null },
  };
}

export function parseShellSession(data: unknown): ShellAuthSession | null {
  const parsed = parseSessionResponse(data);
  if (!parsed) return null;
  if (!parsed.authenticated) return { status: "anonymous", user: null };
  return {
    status: "authenticated",
    user: { username: parsed.user.username, role: parsed.user.role },
  };
}
