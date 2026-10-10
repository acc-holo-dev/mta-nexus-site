"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SupportCaseActions } from "./support-case-actions";
import { SupportStatusHistory } from "./support-status-history";
import {
  SupportClientFailure,
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../lib/support-workspace-copy";
import { useNexusLocale } from "./locale-context";
import {
  clearSupportRetry,
  reserveSupportReplyRetry,
  resolveSupportRetryActorScope,
} from "../lib/support-retry";
import {
  confirmSupportReply,
  confirmSupportStatusChanged,
  parseSupportThread,
  type SupportCaseData,
  type SupportMessageData,
} from "../lib/support-response";

export function SupportCaseThread({
  caseId,
  staffMode = false,
}: {
  caseId: string;
  staffMode?: boolean;
}) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.support,
    workspaceCopy = supportWorkspaceCopy(locale);
  const [capabilities, setCapabilities] = useState({ staff: false, requester: false });
  const [success, setSuccess] = useState("");
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

  const load = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
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
        setCapabilities({ staff: validated.staff, requester: validated.requester });
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
    },
    [caseId, copy.loadError, messagePage],
  );

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
    if (!supportCase.updatedAt) {
      setError(workspaceCopy.uncertain);
      mutationInFlight.current = false;
      return;
    }
    const expectedStatus = supportCase.status;
    setSending(true);
    setSuccess("");
    setError(null);
    try {
      const actorScope = await resolveSupportRetryActorScope();
      const attempt = await reserveSupportReplyRetry(caseId, reply.trim(), expectedStatus, {
        actorScope,
        expectedUpdatedAt: supportCase.updatedAt,
      });
      const { key: requestKey, payload } = attempt;
      pendingReply.current = { payload, key: requestKey };
      const response = await fetch(`/api/support/${encodeURIComponent(caseId)}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey,
        },
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        // A definitive conflict means this request was not committed.
        clearSupportRetry(`reply:${caseId}`, requestKey, { actorScope });
        pendingReply.current = null;
        if (await load()) setError(workspaceCopy.conflict);
        return;
      }
      const confirmed = confirmSupportReply(response.status, data, caseId, reply);
      if (!response.ok || !confirmed) {
        throw new SupportClientFailure(
          response.status >= 400 && response.status < 500
            ? supportWorkspaceError(locale, data?.code ?? response.status)
            : workspaceCopy.uncertain,
        );
      }

      clearSupportRetry(`reply:${caseId}`, requestKey, { actorScope });
      pendingReply.current = null;
      setSupportCase(confirmed.supportCase);
      setSuccess(workspaceCopy.replySaved);
      if (data?.replayed === true) {
        // Replays may refer to an earlier write after the thread changed.
        setReply("");
        if (messagePage === 1) {
          if (!(await load())) setError(workspaceCopy.savedRefresh);
        } else {
          setMessagePage(1);
        }
        return;
      }
      const nextTotal = messageTotal + 1;
      setMessageTotal(nextTotal);
      setMessageTotalPages(Math.max(1, Math.ceil(nextTotal / 100)));
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
    } catch (caught) {
      setError(caught instanceof SupportClientFailure ? caught.message : workspaceCopy.uncertain);
    } finally {
      mutationInFlight.current = false;
      setSending(false);
    }
  }

  async function updateStatus(status: SupportCaseData["status"]) {
    if (mutationInFlight.current || !supportCase) return;
    mutationInFlight.current = true;
    // Snapshot the status visible when the moderator initiated the action.
    if (!supportCase.updatedAt) {
      setError(workspaceCopy.uncertain);
      mutationInFlight.current = false;
      return;
    }
    const expectedStatus = supportCase.status,
      expectedUpdatedAt = supportCase.updatedAt;
    setUpdatingStatus(true);
    setSuccess("");
    setError(null);
    try {
      const response = await fetch(`/api/support/${encodeURIComponent(caseId)}`, {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedStatus, expectedUpdatedAt }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409) {
        if (await load()) setError(workspaceCopy.conflict);
        return;
      }
      const confirmed = confirmSupportStatusChanged(
        response.status,
        data,
        caseId,
        status,
        expectedUpdatedAt,
      );
      if (!response.ok || !confirmed) {
        throw new SupportClientFailure(
          response.status >= 400 && response.status < 500
            ? supportWorkspaceError(locale, data?.code ?? response.status)
            : workspaceCopy.uncertain,
        );
      }

      setSupportCase(confirmed);
      setSuccess(workspaceCopy.saved);
    } catch (caught) {
      setError(caught instanceof SupportClientFailure ? caught.message : workspaceCopy.uncertain);
    } finally {
      mutationInFlight.current = false;
      setUpdatingStatus(false);
    }
  }

  const backHref = staffMode ? "/admin/support" : "/support";

  if (loading) {
    return <p className="mx-auto max-w-4xl text-sm text-muted">{copy.loading}</p>;
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
        {success && (
          <p role="status" className="text-sm text-success">
            {success}
          </p>
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-9 text-sm text-accent underline"
        >
          {workspaceCopy.reload}
        </button>
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
            <h1 className="mt-1 font-display text-primary">{supportCase.subject}</h1>
          </div>
          <span className="rounded-full border border-base bg-inset px-3 py-1 font-label text-muted">
            {supportCase.status === "open"
              ? copy.open
              : supportCase.status === "resolved"
                ? copy.resolved
                : copy.closed}
          </span>
        </div>

        <SupportCaseActions
          supportCase={supportCase}
          staff={capabilities.staff}
          requester={capabilities.requester}
          busy={updatingStatus || sending}
          locale={locale}
          onChangeStatus={(status) => void updateStatus(status)}
        />
      </header>

      {success && (
        <p role="status" className="text-sm text-success">
          {success}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
          <button
            type="button"
            disabled={sending || updatingStatus}
            onClick={() => void load()}
            className="ml-3 min-h-9 text-accent underline"
          >
            {workspaceCopy.reload}
          </button>
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
            onClick={() => setMessagePage((value) => Math.max(1, value - 1))}
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
            onClick={() => setMessagePage((value) => Math.min(messageTotalPages, value + 1))}
            className="text-sm text-accent underline disabled:opacity-40"
          >
            {dictionary.market.nextPage}
          </button>
        </nav>
      )}

      <SupportStatusHistory caseId={caseId} revision={supportCase.updatedAt} />
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
              disabled={sending || updatingStatus || !supportCase.updatedAt}
              onChange={(event) => setReply(event.target.value)}
              maxLength={4000}
              required
              rows={4}
              className="w-full resize-y rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={sending || updatingStatus || !supportCase.updatedAt}
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
