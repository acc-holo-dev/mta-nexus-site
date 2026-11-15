"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ShellAuthSession } from "./shell-destination-policy";
import { parseShellSession } from "./shell-session-payload";
import { requestShellSessionRefresh, SHELL_SESSION_REFRESH_EVENT } from "./shell-session-refresh";

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
        const parsed = parseShellSession(data);
        if (!parsed) throw new Error("session_invalid");
        if (active) setSession(parsed);
      })
      .catch(() => {
        // Fail closed without presenting an unavailable probe as a confirmed sign-out.
        if (active)
          setSession({
            status: "unavailable",
            user: null,
            retry: requestShellSessionRefresh,
          });
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
    window.addEventListener(SHELL_SESSION_REFRESH_EVENT, recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
      window.removeEventListener(SHELL_SESSION_REFRESH_EVENT, recheck);
    };
  }, []);

  return session;
}
