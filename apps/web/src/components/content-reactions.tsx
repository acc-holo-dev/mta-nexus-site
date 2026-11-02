"use client";
import { CONTENT_REACTION_EMOJI, CONTENT_REACTIONS, type ContentReaction } from "@nexus/domain";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  confirmedReactionMutation,
  type ReactionState,
  reactionStateSchema,
} from "../lib/content-reaction-contract";
import { reactionCopy, reactionError } from "../lib/content-reaction-copy";
import { getDictionary, type Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
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
  const pathname = usePathname();
  const copy = reactionCopy(locale),
    workspace = getDictionary(locale).workspace,
    [state, setState] = useState(initial),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(!initial),
    [message, setMessage] = useState(initial ? "" : copy.unavailable),
    [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname)),
    [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  const busy = useRef(false),
    alive = useRef(true),
    request = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh auth return paths after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
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
  return (
    <section className="space-y-3" aria-label={copy.title} aria-busy={pending}>
      <p className="text-sm text-secondary">
        {!state ? copy.unknownCounts : state.self ? copy.own : copy.choose}
      </p>
      <div className="flex flex-wrap gap-2">
        {CONTENT_REACTIONS.map((reaction) => (
          <Button
            key={reaction}
            type="button"
            variant="outline"
            className={`min-h-11 gap-2 ${state?.reaction === reaction ? "bg-accent-soft text-accent" : "bg-inset"}`}
            aria-pressed={state ? state.reaction === reaction : undefined}
            disabled={pending || blocked || !state?.authenticated || state.self}
            onClick={() => void send(state?.reaction === reaction ? null : reaction)}
          >
            <span aria-hidden="true">{CONTENT_REACTION_EMOJI[reaction]}</span>
            {copy[reaction]}{" "}
            <span className="font-numeric">{state ? state.counts[reaction] : "—"}</span>
          </Button>
        ))}
        {state?.reaction && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending || blocked}
            onClick={() => void send(null)}
          >
            {copy.remove}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => void send()}
        >
          {pending ? copy.saving : copy.reload}
        </Button>
      </div>
      {state && !state.authenticated && (
        <div className="flex flex-wrap items-center gap-4">
          <Link
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            href={loginHref}
          >
            {copy.signIn}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center text-sm text-secondary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            href={registerHref}
          >
            {workspace.createAccount}
          </Link>
        </div>
      )}
      {state?.authenticated && (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
