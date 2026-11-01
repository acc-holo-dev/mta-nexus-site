"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ShellAuthSession } from "./shell-destination-policy";

function parseSessionPayload(data: unknown): ShellAuthSession {
  if (!data || typeof data !== "object") {
    return { status: "anonymous", user: null };
  }

  const payload = data as {
    authenticated?: unknown;
    user?: { username?: unknown; role?: unknown } | null;
  };

  if (payload.authenticated !== true) {
    return { status: "anonymous", user: null };
  }

  const username = payload.user?.username;
  if (typeof username !== "string" || username.length === 0) {
    return { status: "anonymous", user: null };
  }

  const role = payload.user?.role;
  return {
    status: "authenticated",
    user: {
      username,
      // Role is already on the public User from GET /api/auth/session — no schema change.
      role: typeof role === "string" ? role : null,
    },
  };
}

/**
 * Client session for shell chrome. Same endpoint as AccountControls.
 * Presentation only — never a substitute for server authz.
 */
export function useAuthSession(): ShellAuthSession {
  const pathname = usePathname();
  const [session, setSession] = useState<ShellAuthSession>({
    status: "loading",
    user: null,
  });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Recheck after navigation (sign-in / sign-out).
  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    setSession({ status: "loading", user: null });

    fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("session_unavailable");
        }
        if (active) setSession(parseSessionPayload(data));
      })
      .catch(() => {
        // Fail closed for protected destinations: treat as anonymous chrome.
        if (active) setSession({ status: "anonymous", user: null });
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [pathname, attempt]);

  useEffect(() => {
    const recheck = () => setAttempt((value) => value + 1);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, []);

  return session;
}
