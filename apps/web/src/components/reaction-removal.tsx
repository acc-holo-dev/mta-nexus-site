"use client";
import { Button } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import { confirmedReactionRemoval } from "../lib/content-reaction-contract";
import { reactionCopy, reactionError } from "../lib/content-reaction-copy";
import type { Locale } from "../lib/i18n";
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
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          isLoading={phase === "saving"}
          disabled={phase !== "idle"}
          onClick={() => void remove()}
        >
          {phase === "saving" ? copy.saving : copy.remove}
        </Button>
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
