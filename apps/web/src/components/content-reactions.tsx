"use client";
import { CONTENT_REACTION_EMOJI, CONTENT_REACTIONS, type ContentReaction } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
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
import { confirmAction } from "./confirm-action";
import { GuestAuthLinks } from "./guest-auth-links";
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
    request = useRef<AbortController | null>(null),
    epoch = useRef(0);
  const scope = `${contentId}:${slug}:${initial?.actorId ?? "guest"}`;
  const previousScope = useRef(scope),
    readyScope = useRef(scope);
  if (previousScope.current !== scope) {
    previousScope.current = scope;
    epoch.current++;
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh auth return paths after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
  // scope identifies the publication and actor; changing other props must not replace an active request.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the identity boundary.
  useEffect(() => {
    alive.current = true;
    readyScope.current = scope;
    request.current?.abort();
    busy.current = false;
    setState(initial);
    setPending(false);
    setBlocked(!initial);
    setMessage(initial ? "" : copy.unavailable);
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, [scope]);
  async function send(reaction?: ContentReaction | null) {
    if (
      readyScope.current !== scope ||
      previousScope.current !== scope ||
      busy.current ||
      (reaction !== undefined && (!state?.actorId || blocked))
    )
      return;
    const operationEpoch = epoch.current;
    const actorId = state?.actorId;
    busy.current = true;
    try {
      if (
        reaction === null &&
        !(await confirmAction({
          title: copy.removeConfirmTitle,
          object: state?.reaction ? copy[state.reaction] : copy.title,
          consequences: copy.removeConfirm,
          confirmLabel: copy.remove,
          cancelLabel: copy.cancel,
          closeLabel: copy.cancel,
          danger: false,
        }))
      )
        return;
    } catch {
      if (alive.current && operationEpoch === epoch.current) {
        setBlocked(true);
        setMessage(copy.uncertain);
      }
      return;
    } finally {
      if (operationEpoch === epoch.current) busy.current = false;
    }
    if (!alive.current || operationEpoch !== epoch.current || busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`/api/content/${encodeURIComponent(slug)}/reactions`, {
        ...privateApiRequest({
          method: reaction === undefined ? "GET" : "PUT",
          ...(reaction !== undefined ? { json: { reaction } } : {}),
          signal: controller.signal,
          timeoutMs: 15_000,
        }),
        ...(reaction !== undefined
          ? { headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId ?? "" } }
          : {}),
      });
      const data = await response.json().catch(() => null);
      if (!alive.current || operationEpoch !== epoch.current || controller.signal.aborted) return;
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
        const confirmed = confirmedReactionMutation(data, contentId, slug, reaction, actorId ?? "");
        if (!confirmed) throw new Error("Unconfirmed mutation");
        setState((current) =>
          current ? { ...current, reaction: confirmed.reaction, counts: confirmed.counts } : null,
        );
        setBlocked(false);
        setMessage(reaction === null ? copy.removed : copy.saved);
      }
    } catch {
      if (alive.current && operationEpoch === epoch.current && !controller.signal.aborted) {
        setBlocked(true);
        setMessage(reaction === undefined ? copy.unavailable : copy.uncertain);
      }
    } finally {
      if (operationEpoch === epoch.current) {
        busy.current = false;
        if (alive.current && !controller.signal.aborted) setPending(false);
      }
    }
  }
  const shownState = readyScope.current === scope ? state : null;
  return (
    <section className="space-y-3" aria-label={copy.title} aria-busy={pending}>
      <p className="text-sm text-secondary">
        {!shownState ? copy.unknownCounts : shownState.self ? copy.own : copy.choose}
      </p>
      <div className="flex flex-wrap gap-2">
        {CONTENT_REACTIONS.map((reaction) => (
          <Button
            key={reaction}
            type="button"
            variant="outline"
            className={`min-h-11 gap-2 ${shownState?.reaction === reaction ? "bg-accent-soft text-accent" : "bg-inset"}`}
            aria-pressed={shownState ? shownState.reaction === reaction : undefined}
            disabled={pending || blocked || !shownState?.authenticated || shownState.self}
            onClick={() => void send(shownState?.reaction === reaction ? null : reaction)}
          >
            <span aria-hidden="true">{CONTENT_REACTION_EMOJI[reaction]}</span>
            {copy[reaction]}{" "}
            <span className="font-numeric">{shownState ? shownState.counts[reaction] : "—"}</span>
          </Button>
        ))}
        {shownState?.reaction && (
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
      {shownState && !shownState.authenticated && (
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.signIn}
          createAccountLabel={workspace.createAccount}
        />
      )}
      {shownState?.authenticated && (
        <Link
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          href="/workspace/reactions"
        >
          {copy.my}
        </Link>
      )}
      {message && blocked ? (
        <ErrorState id="content-reactions-unavailable" title={message} />
      ) : null}
      {message && !blocked ? (
        <p role="status" className="text-xs text-success">
          {message}
        </p>
      ) : null}
      <p className="text-xs text-muted">{copy.scope}</p>
    </section>
  );
}
