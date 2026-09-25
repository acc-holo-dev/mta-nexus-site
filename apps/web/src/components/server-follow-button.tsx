"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [state, setState] = useState<FollowState>("checking");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    setState("checking");
    fetch(
      `/api/follow?targetType=server&targetId=${encodeURIComponent(serverId)}`,
      {
        cache: "no-store",
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

      if (response.status === 409 && state === "not-following") {
        setState("following");
        return;
      }

      if (!response.ok) throw new Error("Follow mutation failed");

      setState(state === "following" ? "not-following" : "following");
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
        className={`${baseClass} border-base bg-neutral-900 text-neutral-200 hover:bg-neutral-800`}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        Sign in to follow
      </Link>
    );
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => setAttempt((value) => value + 1)}
        className={`${baseClass} border-amber-500/30 bg-amber-500/10 text-amber-300`}
      >
        Retry follow status
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
          ? `Checking follow status for ${serverName}`
          : following
            ? `Unfollow ${serverName}`
            : `Follow ${serverName}`
      }
      className={`${baseClass} disabled:cursor-wait disabled:opacity-60 ${
        following
          ? "border-blue-500/30 bg-blue-500/15 text-blue-300 hover:bg-blue-500/20"
          : "border-base bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
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
        ? "Checking..."
        : pending
          ? "Saving..."
          : following
            ? "Following"
            : "Follow server"}
    </button>
  );
}
