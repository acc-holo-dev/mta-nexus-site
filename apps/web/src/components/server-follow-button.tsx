"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNexusLocale } from "./locale-context";
import { confirmsFollowMutation } from "../lib/follow-confirmation";

type FollowState =
  | "checking"
  | "anonymous"
  | "following"
  | "not-following"
  | "error";

export function ServerFollowButton({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.follow;
  const [state, setState] = useState<FollowState>("checking");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    setState("checking");
    fetch(
      `/api/follow?targetType=server&targetId=${encodeURIComponent(serverId)}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Follow status unavailable");
        const data = await response.json();
        if (
          typeof data.authenticated !== "boolean" ||
          typeof data.following !== "boolean"
        ) {
          throw new Error("Invalid follow response");
        }
        if (!active) return;
        if (!data.authenticated) {
          setState("anonymous");
          return;
        }
        setState(data.following ? "following" : "not-following");
      })
      .catch(() => {
        if (active) setState("error");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [serverId, attempt]);

  async function toggleFollow() {
    if (
      pending ||
      (state !== "following" && state !== "not-following")
    ) {
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/follow", {
        method: state === "following" ? "DELETE" : "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "server",
          targetId: serverId,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 401) {
        setState("anonymous");
        return;
      }
      const data = await response.json().catch(() => null);
      const expectedFollowing = state !== "following";
      if (
        !confirmsFollowMutation(
          response.status,
          data,
          "server",
          serverId,
          expectedFollowing,
        )
      ) {
        throw new Error("Follow mutation could not be confirmed");
      }

      setState(expectedFollowing ? "following" : "not-following");
    } catch {
      setState("error");
    } finally {
      setPending(false);
    }
  }

  const baseClass =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

  if (state === "anonymous") {
    return (
      <Link
        href="/auth/login"
        className={`${baseClass} border-base bg-surface text-secondary hover:bg-hover hover:text-primary`}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {copy.signIn}
      </Link>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => setAttempt((value) => value + 1)}
        className={`${baseClass} border-[color:var(--nexus-warning)]/25 bg-warning-soft text-warning`}
      >
        {copy.retry}
      </button>
    );
  }

  const following = state === "following";

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={pending || state === "checking"}
      aria-pressed={state === "checking" ? undefined : following}
      aria-label={
        state === "checking"
          ? `${copy.checkingAria} ${serverName}`
          : following
            ? `${copy.unfollowAria} ${serverName}`
            : `${copy.followAria} ${serverName}`
      }
      className={`${baseClass} disabled:cursor-wait disabled:opacity-60 ${
        following
          ? "border-[color:var(--nexus-accent)]/30 bg-accent-soft text-accent hover:opacity-80"
          : "border-base bg-surface text-secondary hover:bg-hover hover:text-primary"
      }`}
    >
      {pending || state === "checking" ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : following ? (
        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      )}
      {state === "checking"
        ? copy.checking
        : pending
          ? copy.saving
          : following
            ? copy.following
            : copy.follow}
    </button>
  );
}

