"use client";
import {
  ORDER_CASE_KINDS,
  type OrderCaseKind,
  type OrderCaseReview,
  type OrderCaseReviewStatus,
  type SupportCaseStatus,
} from "@nexus/domain";
import { Button, ErrorState, fieldClassBlock } from "@nexus/ui";
import { orderCaseCreateSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { orderCaseActionLabel, orderCaseCopy, orderCaseKindLabel } from "../lib/order-case-i18n";
import {
  confirmOrderCaseCreated,
  confirmOrderCaseReviewed,
  parseOrderCaseAmount,
} from "../lib/order-case-response";
import {
  clearSupportRetry,
  reserveSupportCaseRetry,
  resolveSupportRetryActorScope,
} from "../lib/support-retry";

export function OrderCaseCreateForm({
  orderId,
  currency,
  total,
  locale,
}: {
  orderId: string;
  currency: string;
  total: number;
  locale: string;
}) {
  const copy = orderCaseCopy(locale),
    router = useRouter();
  const [kind, setKind] = useState<OrderCaseKind>("resource_issue"),
    [subject, setSubject] = useState(""),
    [message, setMessage] = useState(""),
    [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [savedId, setSavedId] = useState<string | null>(null);
  const locked = useRef(false),
    pending = useRef<{ payload: string; key: string } | null>(null);
  const monetary = kind === "refund_request" || kind === "dispute",
    supported = ["USD", "EUR", "RUB"].includes(currency);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || savedId) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const requestedAmount = monetary ? parseOrderCaseAmount(amount, total) : null;
      const draft = { kind, subject: subject.trim(), message: message.trim(), requestedAmount };
      if (
        !orderCaseCreateSchema.safeParse({
          ...draft,
          requestId: "00000000-0000-4000-8000-000000000000",
        }).success ||
        (requestedAmount !== null && !supported)
      ) {
        setError(copy.invalid);
        return;
      }
      // Reuse the existing actor-scoped support retry store. Only its key and
      // payload digest persist; the order and private text stay in memory.
      const payload = JSON.stringify({ orderId, ...draft }),
        actorScope = await resolveSupportRetryActorScope();
      const attempt = await reserveSupportCaseRetry(payload, {
        actorScope,
        newKey: () =>
          pending.current?.payload === payload ? pending.current.key : crypto.randomUUID(),
      });
      pending.current = { payload, key: attempt.key };
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/support`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, requestId: attempt.key }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => null);
      const confirmed = response.ok ? confirmOrderCaseCreated(result, orderId, attempt.key) : null;
      if (!confirmed) {
        if (response.status >= 400 && response.status < 500) {
          clearSupportRetry("case", attempt.key, { actorScope });
          pending.current = null;
        }
        setError(
          result?.code === "ORDER_CASE_EXISTS"
            ? copy.exists
            : response.status >= 400 && response.status < 500
              ? copy.failed
              : copy.uncertain,
        );
        return;
      }
      clearSupportRetry("case", attempt.key, { actorScope });
      pending.current = null;
      setSavedId(confirmed);
      try {
        router.push(`/workspace/order-cases/${encodeURIComponent(confirmed)}`);
      } catch {
        /* The saved receipt and its link remain available if navigation fails. */
      }
    } catch {
      setError(copy.uncertain);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={busy}
      className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5"
    >
      <fieldset disabled={busy || savedId !== null} className="space-y-4">
        <label className="block space-y-2">
          <span>{copy.kind}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as OrderCaseKind)}
            className={fieldClassBlock}
          >
            {ORDER_CASE_KINDS.map((value) => (
              <option
                key={value}
                value={value}
                disabled={value === "refund_request" && (!supported || total < 1)}
              >
                {orderCaseKindLabel(locale, value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span>{copy.subject}</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            minLength={5}
            maxLength={120}
            className={fieldClassBlock}
          />
        </label>
        <label className="block space-y-2">
          <span>{copy.message}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            className={fieldClassBlock}
          />
        </label>
        {monetary && (
          <label className="block space-y-2">
            <span>
              {copy.amount} ({currency})
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required={kind === "refund_request"}
              disabled={!supported || total < 1}
              maxLength={13}
              className={fieldClassBlock}
            />
            <span className="block text-sm text-secondary">{copy.amountHelp}</span>
          </label>
        )}
        <Button type="submit" variant="outline" isLoading={busy} className="min-h-11">
          {busy ? copy.busy : copy.send}
        </Button>
      </fieldset>
      {error ? <ErrorState title={error} description={copy.formErrorHint} /> : null}
      {savedId && (
        <p role="status">
          {copy.saved}{" "}
          <Link
            href={`/workspace/order-cases/${encodeURIComponent(savedId)}`}
            className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.open}
          </Link>
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => router.refresh()}
        className="h-auto min-h-11 rounded px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.reload}
      </Button>
    </form>
  );
}

export function OrderCaseReviewForm({
  actorId,
  caseId,
  reviewStatus,
  revision,
  supportUpdatedAt,
  evidenceHash,
  threadStatus,
  canRecommendRefund,
  monetary,
  recommendationEligible,
  locale,
}: {
  actorId: string;
  caseId: string;
  reviewStatus: OrderCaseReviewStatus;
  revision: number;
  supportUpdatedAt: string;
  evidenceHash: string;
  threadStatus: SupportCaseStatus;
  canRecommendRefund: boolean;
  monetary: boolean;
  recommendationEligible: boolean;
  locale: string;
}) {
  const copy = orderCaseCopy(locale),
    router = useRouter(),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sealed, setSealed] = useState(false),
    [saved, setSaved] = useState(false);
  const locked = useRef(false),
    epoch = useRef(0),
    controller = useRef<AbortController | null>(null);
  const identity = `${actorId}:${caseId}`;
  const current = useRef(identity),
    ready = useRef(identity);
  if (current.current !== identity) {
    current.current = identity;
    epoch.current++;
  }
  useEffect(() => {
    ready.current = identity;
    locked.current = false;
    controller.current?.abort();
    setNotes("");
    setBusy(false);
    setMessage("");
    setSealed(false);
    setSaved(false);
    return () => {
      epoch.current++;
      controller.current?.abort();
    };
  }, [identity]);
  const actions: OrderCaseReview["action"][] =
    threadStatus !== "open"
      ? ["reopen"]
      : reviewStatus !== "reviewing"
        ? ["start_review"]
        : [
            "request_info",
            "resolve",
            "dismiss",
            ...(canRecommendRefund && monetary
              ? (["recommend_refund", "decline_refund"] as const)
              : []),
          ];
  async function review(action: OrderCaseReview["action"]) {
    if (
      ready.current !== identity ||
      current.current !== identity ||
      locked.current ||
      sealed ||
      notes.trim().length < 3
    )
      return;
    const version = epoch.current,
      abort = new AbortController();
    controller.current = abort;
    locked.current = true;
    setBusy(true);
    setMessage("");
    const command: OrderCaseReview = {
      action,
      notes: notes.trim(),
      expectedRevision: revision,
      expectedSupportUpdatedAt: supportUpdatedAt,
      expectedEvidenceHash: evidenceHash,
    };
    try {
      const response = await fetch(
        `/api/admin/commerce/order-cases/${encodeURIComponent(caseId)}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
          body: JSON.stringify(command),
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
        },
      );
      const data = await response.json().catch(() => null);
      if (version !== epoch.current || abort.signal.aborted) return;
      if (
        response.ok &&
        data?.actorId === actorId &&
        confirmOrderCaseReviewed(data, caseId, command, reviewStatus)
      ) {
        setSaved(true);
        setMessage(copy.reviewSaved);
        setSealed(true);
        return;
      }
      setMessage(
        response.status === 409
          ? copy.conflict
          : response.status >= 400 && response.status < 500
            ? copy.failed
            : copy.uncertain,
      );
      setSealed(true);
    } catch {
      if (version === epoch.current && !abort.signal.aborted) {
        setMessage(copy.uncertain);
        setSealed(true);
      }
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  if (ready.current !== identity) return null;
  return (
    <section className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5" aria-busy={busy}>
      <h2 className="text-lg font-semibold">{copy.review}</h2>
      <label className="block space-y-2">
        <span>{copy.notes}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy || sealed}
          minLength={3}
          maxLength={2000}
          rows={4}
          className={fieldClassBlock}
        />
        <span className="block text-sm text-secondary">{copy.notesHelp}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            type="button"
            key={action}
            variant="outline"
            className="min-h-11"
            disabled={
              busy ||
              sealed ||
              notes.trim().length < 3 ||
              (action === "recommend_refund" && !recommendationEligible)
            }
            onClick={() => void review(action)}
          >
            {orderCaseActionLabel(locale, action)}
          </Button>
        ))}
      </div>
      {canRecommendRefund && monetary && !recommendationEligible && (
        <p className="text-sm text-secondary">{copy.recommendationBlocked}</p>
      )}
      {message ? (
        saved ? (
          <p role="status" className="text-sm text-success">
            {message}
          </p>
        ) : (
          <ErrorState title={message} description={copy.formErrorHint} />
        )
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => router.refresh()}
        className="h-auto min-h-11 rounded px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.reload}
      </Button>
    </section>
  );
}
