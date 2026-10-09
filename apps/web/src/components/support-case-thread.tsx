"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNexusLocale } from "./locale-context";
import { clearSupportRetry, reserveSupportReplyRetry, resolveSupportRetryActorScope } from "../lib/support-retry";
import { confirmSupportReply, confirmSupportStatusChanged, parseSupportThread, type SupportCaseData, type SupportMessageData } from "../lib/support-response";

export function SupportCaseThread({
  caseId,
  staffMode = false,
}: {
  caseId: string;
  staffMode?: boolean;
}) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.support;
  const [supportCase, setSupportCase] = useState<SupportCaseData | null>(null);
  const [messages, setMessages] = useState<SupportMessageData[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [messageTotalPages, setMessageTotalPages] = useState(1);
  const [messageTotal, setMessageTotal] = useState(0);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const mutationInFlight = useRef(false);
  const pendingReply = useRef<{ payload: string; key: string } | null>(null);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  const categories: Record<string, string> = {
    account: copy.categoryAccount,
    resource: copy.categoryResource,
    server: copy.categoryServer,
    purchase: copy.categoryPurchase,
    license: copy.categoryLicense,
    payment: copy.categoryPayment,
    seller: copy.categorySeller,
    integration: copy.categoryIntegration,
    other: copy.categoryOther,
  };

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const sequence = ++loadSequence.current;
    const isCurrent = () => sequence === loadSequence.current && !signal?.aborted;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/support/${encodeURIComponent(caseId)}?messagePage=${messagePage}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
            : AbortSignal.timeout(15_000),
        },
      );
      if (!isCurrent()) return false;
      const data = await response.json().catch(() => null);
      if (!isCurrent()) return false;
      const validated = parseSupportThread(data, caseId);
      if (!response.ok || !validated) throw new Error(copy.loadError);

      setSupportCase(validated.supportCase);
      setMessages(validated.messages);
      setMessagePage(validated.messagePage);
      setMessageTotalPages(validated.messageTotalPages);
      setMessageTotal(validated.messageTotal);
      return true;
    } catch {
      if (!isCurrent()) return false;
      setSupportCase(null);
      setMessages([]);
      setError(copy.loadError);
      return false;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [caseId, copy.loadError, messagePage]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      loadSequence.current += 1;
    };
  }, [load]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current || !reply.trim() || !supportCase) return;
    mutationInFlight.current = true;
    const expectedStatus = supportCase.status;
    setSending(true);
    setError(null);
    try {
      const actorScope = await resolveSupportRetryActorScope();
      const attempt = await reserveSupportReplyRetry(caseId, reply.trim(), expectedStatus, { actorScope });
      const { key: requestKey, payload } = attempt;
      pendingReply.current = { payload, key: requestKey };
      const response = await fetch(
        `/api/support/${encodeURIComponent(caseId)}`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": requestKey,
          },
          body: payload,
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        // A definitive conflict means this request was not committed.
        clearSupportRetry("reply:" + caseId, requestKey, { actorScope });
        pendingReply.current = null;
        if (await load()) setError(copy.replyConflict);
        return;
      }
      const confirmed = confirmSupportReply(
        response.status,
        data,
        caseId,
        reply,
      );
      if (!response.ok || !confirmed) {
        throw new Error(copy.replyError);
      }

      clearSupportRetry("reply:" + caseId, requestKey, { actorScope });
      pendingReply.current = null;
      setSupportCase(confirmed.supportCase);
      if (data?.replayed === true) {
        // Replays may refer to an earlier write after the thread changed.
        setReply("");
        if (messagePage === 1) {
          await load();
        } else {
          setMessagePage(1);
        }
        return;
      }
      const nextTotal = messageTotal + 1;
      setMessageTotal(nextTotal);
      setMessageTotalPages(
        Math.max(1, Math.ceil(nextTotal / 100)),
      );
      if (messagePage === 1) {
        setMessages((previous) => {
          if (previous.some((item) => item.id === confirmed.message.id)) {
            return previous;
          }
          return [...previous, confirmed.message].slice(-100);
        });
      } else {
        setMessagePage(1);
      }
      setReply("");
    } catch {
      setError(copy.replyError);
    } finally {
      mutationInFlight.current = false;
      setSending(false);
    }
  }

  async function updateStatus(status: SupportCaseData["status"]) {
    if (mutationInFlight.current || !supportCase) return;
    mutationInFlight.current = true;
    // Snapshot the status visible when the moderator initiated the action.
    const expectedStatus = supportCase.status;
    setUpdatingStatus(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/support/${encodeURIComponent(caseId)}`,
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, expectedStatus }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        if (await load()) setError(copy.statusConflict);
        return;
      }
      const confirmed = confirmSupportStatusChanged(response.status, data, caseId, status);
      if (!response.ok || !confirmed) {
        throw new Error(copy.statusError);
      }

      setSupportCase(confirmed);
    } catch {
      setError(copy.statusError);
    } finally {
      mutationInFlight.current = false;
      setUpdatingStatus(false);
    }
  }

  const backHref = staffMode ? "/admin/support" : "/support";

  if (loading) {
    return (
      <p className="mx-auto max-w-4xl text-sm text-muted">{copy.loading}</p>
    );
  }

  if (!supportCase) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href={backHref} className="text-sm text-accent hover:underline">
          {copy.back}
        </Link>
        <div role="alert" className="nexus-panel p-5 text-sm text-danger">
          {error ?? copy.loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {copy.back}
      </Link>

      <header className="space-y-2 border-b border-base pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-label uppercase text-muted">
              {categories[supportCase.category] ?? supportCase.category}
            </p>
            <h1 className="mt-1 font-display text-primary">
              {supportCase.subject}
            </h1>
          </div>
          <span className="rounded-full border border-base bg-inset px-3 py-1 font-label text-muted">
            {supportCase.status === "open"
              ? copy.open
              : supportCase.status === "resolved"
                ? copy.resolved
                : copy.closed}
          </span>
        </div>

        {staffMode && (
          <div className="flex flex-wrap gap-2">
            {supportCase.status !== "open" && (
              <button
                type="button"
                disabled={updatingStatus || sending}
                onClick={() => void updateStatus("open")}
                className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.reopen}
              </button>
            )}
            {supportCase.status !== "resolved" && (
              <button
                type="button"
                disabled={updatingStatus || sending}
                onClick={() => void updateStatus("resolved")}
                className="rounded-md border border-base bg-surface px-3 py-1.5 text-xs font-semibold text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.resolve}
              </button>
            )}
            {supportCase.status !== "closed" && (
              <button
                type="button"
                disabled={updatingStatus || sending}
                onClick={() => void updateStatus("closed")}
                className="rounded-md border border-[color:var(--nexus-danger)]/30 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-danger)]"
              >
                {copy.close}
              </button>
            )}
          </div>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <section className="space-y-3" aria-label={copy.messages}>
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-xl border p-4 ${
              message.authorRole === "staff"
                ? "border-[color:var(--nexus-accent)]/25 bg-accent-soft"
                : "border-base bg-surface"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-primary">
                {message.authorRole === "staff"
                  ? copy.staff
                  : staffMode
                    ? copy.requester
                    : copy.you}
              </span>
              <time
                dateTime={new Date(message.createdAt).toISOString()}
                className="font-numeric text-[11px] text-faint"
              >
                {new Date(message.createdAt).toLocaleString(dateLocale)}
              </time>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-secondary">
              {message.body}
            </p>
          </article>
        ))}
      </section>

      {messageTotalPages > 1 && (
        <nav
          aria-label={dictionary.market.paginationLabel}
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={messagePage <= 1 || loading || sending || updatingStatus}
            onClick={() =>
              setMessagePage((value) => Math.max(1, value - 1))
            }
            className="text-sm text-accent underline disabled:opacity-40"
          >
            {dictionary.market.previousPage}
          </button>
          <span className="text-sm text-secondary">
            {dictionary.market.pageLabel} {messagePage} / {messageTotalPages}
          </span>
          <button
            type="button"
            disabled={messagePage >= messageTotalPages || loading || sending || updatingStatus}
            onClick={() =>
              setMessagePage((value) =>
                Math.min(messageTotalPages, value + 1),
              )
            }
            className="text-sm text-accent underline disabled:opacity-40"
          >
            {dictionary.market.nextPage}
          </button>
        </nav>
      )}

      {supportCase.status !== "closed" ? (
        <form
          onSubmit={(event) => void sendReply(event)}
          aria-busy={sending}
          className="nexus-panel space-y-3 p-4"
        >
          <label className="block space-y-1.5">
            <span className="font-label text-secondary">{copy.reply}</span>
            <textarea
              value={reply}
              disabled={sending || updatingStatus}
              onChange={(event) => setReply(event.target.value)}
              maxLength={4000}
              required
              rows={4}
              className="w-full resize-y rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={sending || updatingStatus}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {sending ? copy.sending : copy.sendReply}
          </button>
        </form>
      ) : (
        <p className="rounded-lg border border-base bg-inset p-4 text-sm text-muted">
          {copy.closedReply}
        </p>
      )}
    </div>
  );
}
