"use client";

import { Button, buttonClassName } from "@nexus/ui";
import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
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
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
  }, [pathname]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Recheck the session after navigation, including sign-in and sign-out.
  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger; changing it must restart this request.
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
          (data.authenticated && typeof data.user?.username !== "string")
        ) {
          throw new Error(copy.checkError);
        }

        if (active) {
          setAccount(data.authenticated ? { username: data.user.username } : null);
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

  const chromeControl = buttonClassName({
    variant: "outline",
    size: "sm",
    className:
      "shrink-0 rounded-md border-base bg-elevated px-2 font-semibold text-primary sm:px-2.5",
  });

  return (
    // biome-ignore lint/a11y/useSemanticElements: Mixed links and a button form a named group, not a form fieldset.
    <div
      aria-label={copy.groupLabel}
      role="group"
      className="relative flex min-w-0 items-center gap-1.5 sm:gap-2"
    >
      {checking ? (
        <span role="status" className="hidden max-w-28 truncate text-xs text-muted sm:block">
          {copy.checking}
        </span>
      ) : account ? (
        <>
          <Link
            href="/workspace"
            aria-label={`${copy.workspaceFor} ${account.username}`}
            className={chromeControl}
          >
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden max-w-24 truncate sm:block">@{account.username}</span>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void signOut()}
            disabled={signingOut}
            isLoading={signingOut}
            aria-label={signingOut ? copy.signingOut : copy.signOut}
            title={signingOut ? copy.signingOut : copy.signOut}
            className="shrink-0 rounded-md border-base bg-elevated px-2 font-semibold sm:px-2.5"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:block">{signingOut ? copy.signingOut : copy.signOut}</span>
          </Button>
        </>
      ) : error ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAttempt((value) => value + 1)}
          className="shrink-0 rounded-md border-base bg-elevated px-2 font-semibold sm:px-2.5"
        >
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:block">{copy.retry}</span>
          <span className="sr-only sm:hidden">{copy.retry}</span>
        </Button>
      ) : (
        <Link href={loginHref} className={chromeControl}>
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
