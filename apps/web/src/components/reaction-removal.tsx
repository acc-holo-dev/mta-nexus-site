"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { reactionCopy, reactionError } from "../lib/content-reaction-copy";
import { confirmedReactionRemoval } from "../lib/content-reaction-contract";
import { privateApiRequest } from "../lib/private-api-request";
export function ReactionRemoval({
  contentId,
  reloadHref,
  locale,
}: {
  contentId: string;
  reloadHref: string;
  locale: Locale;
}) {
  const copy = reactionCopy(locale),
    [phase, setPhase] = useState<"idle" | "saving" | "removed" | "blocked">("idle"),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    alive = useRef(true),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  async function remove() {
    if (busy.current || phase !== "idle") return;
    busy.current = true;
    setPhase("saving");
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(
        `/api/workspace/reactions/${encodeURIComponent(contentId)}`,
        privateApiRequest({
          method: "DELETE",
          json: {},
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) {
        setPhase("blocked");
        setMessage(reactionError(locale, data?.code));
        return;
      }
      if (!confirmedReactionRemoval(data, contentId)) throw new Error("Unconfirmed removal");
      setPhase("removed");
      setMessage(copy.removed);
    } catch {
      if (alive.current) {
        setPhase("blocked");
        setMessage(copy.uncertain);
      }
    } finally {
      busy.current = false;
    }
  }
  return (
    <div className="space-y-2" aria-busy={phase === "saving"}>
      {phase !== "removed" && (
        <button
          type="button"
          disabled={phase !== "idle"}
          onClick={() => void remove()}
          className="min-h-11 rounded-lg border border-base px-3 text-sm text-secondary focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {phase === "saving" ? copy.saving : copy.remove}
        </button>
      )}
      {message && (
        <p
          role={phase === "blocked" ? "alert" : "status"}
          className={`text-xs ${phase === "blocked" ? "text-danger" : "text-success"}`}
        >
          {message}
        </p>
      )}
      {(phase === "blocked" || phase === "removed") && (
        <a
          href={reloadHref}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reload}
        </a>
      )}
    </div>
  );
}
