"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Account = { username: string };

export function AccountControls() {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setChecking(true);
    setError(null);
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session unavailable");
        const data = await response.json();
        if (typeof data.authenticated !== "boolean"
          || (data.authenticated && typeof data.user?.username !== "string")) {
          throw new Error("Invalid session response");
        }
        if (active) setAccount(data.authenticated ? { username: data.user.username } : null);
      })
      .catch(() => {
        if (active) {
          setAccount(null);
          setError("Could not check your account. Try again.");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [pathname, attempt]);

  useEffect(() => {
    // Revalidate after another tab signs out or a page returns from browser history.
    const recheck = () => setAttempt((value) => value + 1);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || (await response.json()).success !== true) {
        throw new Error("Logout not confirmed");
      }
      // A new document discards private client/router state at the auth boundary.
      window.location.replace("/auth/login");
    } catch {
      setError("Could not confirm sign out. Your session may still be active. Try again.");
      setSigningOut(false);
    }
  }

  const control = "rounded-md border border-base px-3 py-2 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
  return (
    <div aria-label="Account" role="group" className="relative flex min-w-0 items-center gap-2">
      {checking ? <span role="status" className="text-xs text-muted">Checking account...</span>
        : account ? <>
          <Link href="/workspace" aria-label={`Workspace for ${account.username}`} className={control}>
            <span className="block max-w-24 truncate">@{account.username}</span>
          </Link>
          <button type="button" onClick={signOut} disabled={signingOut} className={control + " disabled:opacity-50"}>
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </> : error ? <button type="button" onClick={() => setAttempt((value) => value + 1)} className={control}>Retry account</button>
          : <Link href="/auth/login" className={control}>Sign In</Link>}
      {error && <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[85vw] rounded-md border border-base bg-surface p-3 text-xs text-primary">{error}</p>}
    </div>
  );
}
