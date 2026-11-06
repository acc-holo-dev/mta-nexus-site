"use client";
import { Button, ErrorState } from "@nexus/ui";
import { useEffect, useRef, useState } from "react";
import { confirmedReactionRemoval } from "../lib/content-reaction-contract";
import { reactionCopy, reactionError } from "../lib/content-reaction-copy";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmAction } from "./confirm-action";

export function ReactionRemoval({
  contentId,
  actorId,
  reloadHref,
  locale,
}: {
  contentId: string;
  actorId: string;
  reloadHref: string;
  locale: Locale;
}) {
  const copy = reactionCopy(locale),
    [phase, setPhase] = useState<"idle" | "saving" | "removed" | "blocked">("idle"),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    alive = useRef(true),
    request = useRef<AbortController | null>(null),
    epoch = useRef(0),
    scopeRef = useRef(`${actorId}:${contentId}`),
    readyScope = useRef(`${actorId}:${contentId}`);
  const scope = `${actorId}:${contentId}`;
  if (scopeRef.current !== scope) {
    scopeRef.current = scope;
    epoch.current++;
  }
  useEffect(() => {
    alive.current = true;
    readyScope.current = scope;
    busy.current = false;
    setPhase("idle");
    setMessage("");
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [scope]);
  async function remove() {
    if (
      readyScope.current !== scope ||
      scopeRef.current !== scope ||
      busy.current ||
      phase !== "idle"
    )
      return;
    const operationEpoch = epoch.current;
    busy.current = true;
    let accepted: boolean;
    try {
      accepted = await confirmAction({
        title: copy.removeConfirmTitle,
        object: contentId,
        consequences: copy.removeConfirm,
        confirmLabel: copy.remove,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      });
    } catch {
      if (alive.current && operationEpoch === epoch.current) {
        busy.current = false;
        setPhase("blocked");
        setMessage(copy.uncertain);
      }
      return;
    }
    if (!accepted) {
      if (operationEpoch === epoch.current) busy.current = false;
      return;
    }
    if (!alive.current || operationEpoch !== epoch.current) return;
    setPhase("saving");
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/workspace/reactions/${encodeURIComponent(contentId)}`, {
        ...privateApiRequest({
          method: "DELETE",
          json: {},
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const data = await response.json().catch(() => null);
      if (!alive.current || operationEpoch !== epoch.current || controller.signal.aborted) return;
      if (!response.ok) {
        setPhase("blocked");
        setMessage(reactionError(locale, data?.code));
        return;
      }
      if (!confirmedReactionRemoval(data, contentId, actorId))
        throw new Error("Unconfirmed removal");
      setPhase("removed");
      setMessage(copy.removed);
    } catch {
      if (alive.current && operationEpoch === epoch.current && !controller.signal.aborted) {
        setPhase("blocked");
        setMessage(copy.uncertain);
      }
    } finally {
      if (operationEpoch === epoch.current) busy.current = false;
    }
  }
  if (readyScope.current !== scope) return null;
  return (
    <div className="min-w-0 space-y-2" aria-busy={phase === "saving"}>
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
      {message && phase === "blocked" ? (
        <ErrorState id="reaction-removal-unavailable" title={message} />
      ) : null}
      {message && phase !== "blocked" ? (
        <p role="status" className="text-xs text-success">
          {message}
        </p>
      ) : null}
      {(phase === "blocked" || phase === "removed") && (
        <a
          href={reloadHref}
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.reload}
        </a>
      )}
    </div>
  );
}
