"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CONTENT_REACTIONS, CONTENT_REACTION_EMOJI, type ContentReaction } from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { reactionCopy, reactionError } from "../lib/content-reaction-copy";
import {
  confirmedReactionMutation,
  reactionStateSchema,
  type ReactionState,
} from "../lib/content-reaction-contract";
import { privateApiRequest } from "../lib/private-api-request";
export function ContentReactions({
  slug,
  contentId,
  initial,
  locale,
}: {
  slug: string;
  contentId: string;
  initial: ReactionState | null;
  locale: Locale;
}) {
  const copy = reactionCopy(locale),
    [state, setState] = useState(initial),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(!initial),
    [message, setMessage] = useState(initial ? "" : copy.unavailable);
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
  async function send(reaction?: ContentReaction | null) {
    if (busy.current || (reaction !== undefined && (!state?.authenticated || blocked))) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(
        `/api/content/${encodeURIComponent(slug)}/reactions`,
        privateApiRequest({
          method: reaction === undefined ? "GET" : "PUT",
          ...(reaction !== undefined ? { json: { reaction } } : {}),
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) {
        setBlocked(true);
        setMessage(reactionError(locale, data?.code));
        return;
      }
      if (reaction === undefined) {
        const parsed = reactionStateSchema.safeParse(data);
        if (!parsed.success || parsed.data.contentId !== contentId || parsed.data.slug !== slug)
          throw new Error("Invalid saved state");
        setState(parsed.data);
        setBlocked(false);
      } else {
        const confirmed = confirmedReactionMutation(data, contentId, slug, reaction);
        if (!confirmed) throw new Error("Unconfirmed mutation");
        setState((current) =>
          current ? { ...current, reaction: confirmed.reaction, counts: confirmed.counts } : null,
        );
        setBlocked(false);
        setMessage(reaction === null ? copy.removed : copy.saved);
      }
    } catch {
      if (alive.current) {
        setBlocked(true);
        setMessage(reaction === undefined ? copy.unavailable : copy.uncertain);
      }
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  const style =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-base px-3 text-sm font-semibold text-secondary focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50";
  return (
    <section className="space-y-3" aria-label={copy.title} aria-busy={pending}>
      <p className="text-sm text-secondary">{state?.self ? copy.own : copy.choose}</p>
      <div className="flex flex-wrap gap-2">
        {CONTENT_REACTIONS.map((reaction) => (
          <button
            key={reaction}
            type="button"
            className={`${style} ${state?.reaction === reaction ? "bg-accent-soft text-accent" : "bg-inset"}`}
            aria-pressed={state?.reaction === reaction}
            disabled={pending || blocked || !state?.authenticated || state.self}
            onClick={() => void send(state?.reaction === reaction ? null : reaction)}
          >
            <span aria-hidden="true">{CONTENT_REACTION_EMOJI[reaction]}</span>
            {copy[reaction]} <span className="font-numeric">{state?.counts[reaction] ?? "—"}</span>
          </button>
        ))}
        {state?.reaction && (
          <button
            type="button"
            className={style}
            disabled={pending || blocked}
            onClick={() => void send(null)}
          >
            {copy.remove}
          </button>
        )}
        <button type="button" className={style} disabled={pending} onClick={() => void send()}>
          {pending ? copy.saving : copy.reload}
        </button>
      </div>
      {state && !state.authenticated && (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href="/auth/login"
        >
          {copy.signIn}
        </Link>
      )}
      {state?.authenticated && (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
          href="/workspace/reactions"
        >
          {copy.my}
        </Link>
      )}
      {message && (
        <p
          role={blocked ? "alert" : "status"}
          className={`text-xs ${blocked ? "text-danger" : "text-success"}`}
        >
          {message}
        </p>
      )}
      <p className="text-xs text-muted">{copy.scope}</p>
    </section>
  );
}
