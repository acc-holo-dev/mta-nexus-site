"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNexusLocale } from "./locale-context";

type Account = { username: string };

export function AccountControls() {
  const pathname = usePathname();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.accountControls;
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

    fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (
          !response.ok ||
          typeof data?.authenticated !== "boolean" ||
          (data.authenticated &&
            typeof data.user?.username !== "string")
        ) {
          throw new Error(copy.checkError);
        }

        if (active) {
          setAccount(
            data.authenticated ? { username: data.user.username } : null,
          );
        }
      })
      .catch(() => {
        if (active) {
          setAccount(null);
          setError(copy.checkError);
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
  }, [pathname, attempt, copy.checkError]);

  useEffect(() => {
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
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new Error(copy.signOutError);
      }

      window.location.replace("/auth/login");
    } catch {
      setError(copy.signOutError);
      setSigningOut(false);
    }
  }

  const control =
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-base bg-elevated px-2 text-xs font-semibold text-primary transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] sm:px-2.5";

  return (
    <div
      aria-label={copy.groupLabel}
      // biome-ignore lint/a11y/useSemanticElements: Mixed links and a button form a named group, not a form fieldset.
      role="group"
      className="relative flex min-w-0 items-center gap-1.5 sm:gap-2"
    >
      {checking ? (
        <span
          role="status"
          className="hidden max-w-28 truncate text-xs text-muted sm:block"
        >
          {copy.checking}
        </span>
      ) : account ? (
        <>
          <Link
            href="/workspace"
            aria-label={`${copy.workspaceFor} ${account.username}`}
            className={control}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden max-w-24 truncate sm:block">
              @{account.username}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-label={signingOut ? copy.signingOut : copy.signOut}
            title={signingOut ? copy.signingOut : copy.signOut}
            className={`${control} disabled:opacity-50`}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:block">
              {signingOut ? copy.signingOut : copy.signOut}
            </span>
          </button>
        </>
      ) : error ? (
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className={control}
        >
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:block">{copy.retry}</span>
          <span className="sr-only sm:hidden">{copy.retry}</span>
        </button>
      ) : (
        <Link href="/auth/login" className={control}>
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:block">{copy.signIn}</span>
          <span className="sr-only sm:hidden">{copy.signIn}</span>
        </Link>
      )}

      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[85vw] rounded-md border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-3 text-xs text-danger shadow-nexus"
        >
          {error}
        </p>
      )}
    </div>
  );
}
