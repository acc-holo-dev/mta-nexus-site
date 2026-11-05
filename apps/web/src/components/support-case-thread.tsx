"use client";
import { Button, ErrorState } from "@nexus/ui";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supportMessageCopy } from "../lib/support-message-discovery-copy";
import {
  confirmSupportReply,
  confirmSupportStatusChanged,
  parseSupportThread,
  type SupportCaseData,
  type SupportMessageData,
} from "../lib/support-response";
import {
  clearSupportRetry,
  reserveSupportReplyRetry,
  resolveSupportRetryActorScope,
} from "../lib/support-retry";
import {
  SupportClientFailure,
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../lib/support-workspace-copy";
import { useNexusLocale } from "./locale-context";
import { SupportCaseActions } from "./support-case-actions";
import { type SupportFormObjectContext, supportObjectContextHref } from "./support-center";
import { SupportStatusHistory } from "./support-status-history";

export function SupportCaseThread({
  caseId,
  actorId,
  staffMode = false,
}: {
  caseId: string;
  actorId: string;
  staffMode?: boolean;
}) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.support,
    workspaceCopy = supportWorkspaceCopy(locale);
  const [capabilities, setCapabilities] = useState({ staff: false, requester: false });
  const [success, setSuccess] = useState("");
  const [supportCase, setSupportCase] = useState<SupportCaseData | null>(null);
  const [relatedContext, setRelatedContext] = useState<SupportFormObjectContext | null>(null);
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
        if (response.status === 404) {
          setSupportCase(null);
          setRelatedContext(null);
          setMessages([]);
          setError(workspaceCopy.notFound);
          return false;
        }
        if (data?.actorId !== actorId) throw new Error(copy.caseLoadError);
        const validated = parseSupportThread(data, caseId);
        if (!response.ok || !validated) throw new Error(copy.caseLoadError);

        setSupportCase(validated.supportCase);
        const related = data?.supportCase;
        setRelatedContext(
          related?.relatedType === "product" &&
            typeof related.relatedId === "string" &&
            /^prd_[a-f0-9]{24}$/u.test(related.relatedId)
            ? {
                productId: related.relatedId,
                ...(typeof related.buildId === "string" &&
                /^bld_[a-f0-9]{24}$/u.test(related.buildId)
                  ? { buildId: related.buildId }
                  : {}),
              }
            : null,
        );
        setCapabilities({ staff: validated.staff, requester: validated.requester });
        setMessages(validated.messages);
        setMessagePage(validated.messagePage);
        setMessageTotalPages(validated.messageTotalPages);
        setMessageTotal(validated.messageTotal);
        return true;
      } catch {
        if (!isCurrent()) return false;
        setSupportCase(null);
        setRelatedContext(null);
        setMessages([]);
        setError(copy.caseLoadError);
        return false;
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [caseId, actorId, copy.caseLoadError, messagePage, workspaceCopy.notFound],
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
      const actorScope = await resolveSupportRetryActorScope(actorId);
      if (!actorScope) throw new SupportClientFailure(workspaceCopy.uncertain);
      const attempt = await reserveSupportReplyRetry(caseId, reply.trim(), expectedStatus, {
        actorScope,
        requirePersistence: true,
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
          "x-nexus-actor-id": actorId,
        },
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 409 && data?.code === "ACTOR_CHANGED") {
        throw new SupportClientFailure(workspaceCopy.uncertain);
      }
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
      // Keep the composed reply so a lost response can retry with the same key.
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
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
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
    return (
      <section
        className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
        aria-busy="true"
        aria-labelledby="support-case-thread-loading-heading"
      >
        <header className="space-y-2 border-b border-base pb-5">
          <h1 id="support-case-thread-loading-heading" className="font-display text-primary">
            {copy.title}
          </h1>
          <p role="status" aria-live="polite" className="text-sm text-muted">
            {copy.caseLoading}
          </p>
        </header>
        <div className="animate-pulse space-y-3" aria-hidden="true">
          <div className="h-8 max-w-lg rounded bg-inset" />
          {[1, 2, 3].map((key) => (
            <div key={key} className="h-16 rounded bg-inset" />
          ))}
        </div>
      </section>
    );
  }

  if (!supportCase) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
        <ErrorState
          title={error ?? copy.caseLoadError}
          action={
            <Button
              type="button"
              onClick={() => void load()}
              className="h-auto min-h-11 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              variant="ghost"
            >
              {workspaceCopy.reload}
            </Button>
          }
        />
        {success ? (
          <p role="status" aria-live="polite" className="text-sm text-success">
            {success}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
            {relatedContext ? (
              <p className="mt-2 break-all text-sm text-secondary">
                {copy.contextResource}: {relatedContext.productId}
                {relatedContext.buildId ? ` · ${copy.contextBuild}: ${relatedContext.buildId}` : ""}
                {relatedContext.receiptId
                  ? ` · ${copy.contextReceipt}: ${relatedContext.receiptId}`
                  : ""}
              </p>
            ) : null}
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
        <Link
          href={`${backHref}/${caseId}/messages`}
          className="inline-flex min-h-9 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {supportMessageCopy(locale).title}
        </Link>
      </header>

      {success && (
        <p role="status" aria-live="polite" className="text-sm text-success">
          {success}
        </p>
      )}
      {error ? (
        <ErrorState
          title={error}
          action={
            <Button
              type="button"
              disabled={sending || updatingStatus}
              onClick={() => void load()}
              className="h-auto min-h-11 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              variant="ghost"
            >
              {workspaceCopy.reload}
            </Button>
          }
        />
      ) : null}

      <section className="space-y-3" aria-label={copy.messages}>
        {messages.map((message) => (
          <article
            key={message.id}
            id={`message-${message.id}`}
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
                  : capabilities.requester
                    ? copy.you
                    : copy.requester}
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
            <Link
              href={`${backHref}/${caseId}/messages?focus=${message.id}#message-${message.id}`}
              className="mt-2 inline-flex min-h-9 items-center text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {supportMessageCopy(locale).link}
            </Link>
          </article>
        ))}
      </section>

      {messageTotalPages > 1 && (
        <nav
          aria-label={dictionary.market.paginationLabel}
          className="flex items-center justify-between gap-3"
        >
          <Button
            type="button"
            disabled={messagePage <= 1 || loading || sending || updatingStatus}
            onClick={() => setMessagePage((value) => Math.max(1, value - 1))}
            className="h-auto px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            variant="ghost"
          >
            {dictionary.market.previousPage}
          </Button>
          <span className="text-sm text-secondary">
            {dictionary.market.pageLabel} {messagePage} / {messageTotalPages}
          </span>
          <Button
            type="button"
            disabled={messagePage >= messageTotalPages || loading || sending || updatingStatus}
            onClick={() => setMessagePage((value) => Math.min(messageTotalPages, value + 1))}
            className="h-auto px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            variant="ghost"
          >
            {dictionary.market.nextPage}
          </Button>
        </nav>
      )}

      <SupportStatusHistory caseId={caseId} actorId={actorId} revision={supportCase.updatedAt} />
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
          <Button
            type="submit"
            disabled={sending || updatingStatus || !supportCase.updatedAt}
            isLoading={sending}
            variant="primary"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {sending ? copy.sending : copy.sendReply}
          </Button>
        </form>
      ) : (
        <div className="space-y-3 rounded-lg border border-base bg-inset p-4 text-sm text-muted">
          <p>{copy.closedReply}</p>
          {!staffMode && capabilities.requester ? (
            <p>
              {copy.closedNeedNewCase}{" "}
              <Link
                href={supportObjectContextHref(relatedContext)}
                className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.openRelatedCase}
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
