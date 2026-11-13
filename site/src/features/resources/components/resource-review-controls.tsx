"use client";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "../../../lib/i18n";
import {
  confirmedReview,
  confirmedReviewDecision,
  confirmedReviewReport,
} from "../../../lib/resource-review-confirmation";
import {
  type ResourceReviewEligibilityReason,
  resourceReviewCopy,
  resourceReviewEligibilityCopy,
  resourceReviewError,
  resourceReviewState,
} from "../../../lib/resource-review-i18n";
import { confirmAction } from "../../../components/confirm-action";

const nativeFieldClass =
  "rounded border border-base bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

type Review = {
  text: string;
  rating: number | null;
  status: string;
  revision: number;
  moderationReason?: string | null;
};
type Notice = { text: string; error: boolean };
function Recovery({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto rounded px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      onClick={() => router.refresh()}
    >
      {resourceReviewCopy(locale).reload}
    </Button>
  );
}
async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const value = await response.json().catch(() => null);
  return { response, value };
}
function reviewConfirmObject(source: string, fallback: string) {
  const trimmed = source.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed.length > 0 ? trimmed : fallback;
}
type ResourceReviewDecisionAction = "review" | "resolve" | "dismiss" | "remove_review";
function isDestructiveResourceReviewDecision(action: string): action is "remove_review" {
  return action === "remove_review";
}
export function ResourceReviewEditor({
  productId,
  review,
  canReview,
  eligibility = canReview ? "ok" : "access_required",
  locale,
}: {
  productId: string;
  review: Review | null;
  canReview: boolean;
  eligibility?: ResourceReviewEligibilityReason | string;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale);
  const eligibilityNote = resourceReviewEligibilityCopy(locale, eligibility);
  const [text, setText] = useState(review?.text ?? ""),
    [rating, setRating] = useState(review?.rating ?? 5),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<{ revision: number; status: string } | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [draftRevision, setDraftRevision] = useState(review?.revision ?? 0);
  const currentRevision = review?.revision ?? 0;
  const reflected =
    confirmation !== null &&
    currentRevision === confirmation.revision &&
    review?.status === confirmation.status;
  const confirmed =
    confirmation !== null && !(reflected || currentRevision > confirmation.revision);
  const effectiveDraftRevision = reflected ? currentRevision : draftRevision;
  const changed = dirty && effectiveDraftRevision !== currentRevision;
  const draftText = dirty ? text : (review?.text ?? "");
  const draftRating = dirty ? rating : (review?.rating ?? 5);
  async function submit(action: "save" | "withdraw") {
    if (busy || confirmed || (action === "save" && (changed || !canReview))) return;
    const expectedRevision = action === "save" && dirty ? effectiveDraftRevision : currentRevision;
    setBusy(true);
    setNotice(null);
    try {
      const result = await post(`/api/library/review/${encodeURIComponent(productId)}`, {
        action,
        expectedRevision,
        ...(action === "save" ? { text: draftText, rating: draftRating } : {}),
      });
      if (!result.response.ok) {
        setNotice({ text: resourceReviewError(locale, result.value?.code), error: true });
        return;
      }
      if (!confirmedReview(result.value, expectedRevision, action))
        throw new Error("Unconfirmed review");
      setConfirmation({ revision: result.value.revision, status: result.value.status });
      setNotice({ text: copy.saved, error: false });
    } catch {
      setNotice({ text: copy.unknown, error: true });
    } finally {
      setBusy(false);
    }
  }
  async function withdrawReview() {
    if (busy || confirmed) return;
    const object = reviewConfirmObject(review?.text ?? text, copy.text);
    if (
      !(await confirmAction({
        title: copy.withdrawConfirmTitle,
        object,
        consequences: copy.withdrawConfirm,
        confirmLabel: copy.withdraw,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    void submit("withdraw");
  }
  return (
    <section className="nexus-panel space-y-4 p-5">
      <p className="text-sm text-secondary">{copy.access}</p>
      {eligibilityNote ? (
        <ErrorState id="resource-review-eligibility" title={eligibilityNote} />
      ) : null}
      {review && <p>{resourceReviewState(locale, review.status)}</p>}
      {review?.moderationReason && (
        <p className="text-sm text-secondary">
          {copy.reason}: {review.moderationReason}
        </p>
      )}
      {canReview ? (
        <form
          className="space-y-4"
          aria-busy={busy || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            void submit("save");
          }}
        >
          <label className="block text-sm">
            {copy.rating}
            <select
              value={draftRating}
              onChange={(event) => {
                setNotice(null);
                if (!dirty) {
                  setDraftRevision(currentRevision);
                  setText(review?.text ?? "");
                  setDirty(true);
                }
                setRating(Number(event.target.value));
              }}
              disabled={busy || confirmed}
              className={`${nativeFieldClass} ml-3 p-2`}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {copy.text}
            <textarea
              value={draftText}
              onChange={(event) => {
                setNotice(null);
                if (!dirty) {
                  setDraftRevision(currentRevision);
                  setRating(review?.rating ?? 5);
                  setDirty(true);
                }
                setText(event.target.value);
              }}
              minLength={3}
              maxLength={4000}
              required
              disabled={busy || confirmed}
              className={`${nativeFieldClass} mt-2 block min-h-36 w-full p-3`}
            />
          </label>
          <Button
            type="submit"
            size="touch"
            disabled={busy || confirmed || changed}
            isLoading={busy}
          >
            {busy ? copy.busy : copy.save}
          </Button>
        </form>
      ) : (
        review && (
          <p className="whitespace-pre-wrap break-words text-sm" data-review-copyable="true">
            {review.text}
          </p>
        )
      )}
      {dirty && !canReview && (
        <label className="block space-y-2 text-sm">
          <span>{copy.retainedDraft}</span>
          <textarea
            readOnly
            value={text}
            rows={4}
            className={`${nativeFieldClass} block w-full p-3`}
          />
        </label>
      )}
      {changed && (
        <div className="space-y-2 rounded-lg border border-base p-3 text-sm">
          <p role="status">{copy.draftChanged}</p>
          <p className="font-semibold">{copy.latestReview}</p>
          {review ? (
            <p className="whitespace-pre-wrap break-words">
              {copy.rating}: {review.rating ?? "—"}/5 · {review.text}
            </p>
          ) : (
            <p>{copy.noLatestReview}</p>
          )}
          {canReview && !confirmed && (
            <Button
              type="button"
              size="touch"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraftRevision(currentRevision);
                setConfirmation(null);
              }}
            >
              {copy.useLatest}
            </Button>
          )}
        </div>
      )}
      {review?.status === "published" && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto px-0 text-sm text-danger underline"
          disabled={busy || confirmed || changed}
          onClick={() => void withdrawReview()}
        >
          {copy.withdraw}
        </Button>
      )}
      {notice?.error ? <ErrorState id="resource-review-editor-error" title={notice.text} /> : null}
      {notice && !notice.error ? (
        <p role="status" className="text-sm">
          {notice.text}
        </p>
      ) : null}
      <Recovery locale={locale} />
    </section>
  );
}
export function ResourceReviewReportForm({
  productId,
  reviewId,
  locale,
}: {
  productId: string;
  reviewId: string;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale),
    [reason, setReason] = useState(""),
    [type, setType] = useState("spam"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null),
    [id, setId] = useState<string | null>(null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">{copy.report}</summary>
      <form
        className="mt-3 space-y-3"
        aria-busy={busy || undefined}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || id) return;
          setBusy(true);
          setNotice(null);
          try {
            const result = await post(
              `/api/products/${encodeURIComponent(productId)}/reviews/${encodeURIComponent(reviewId)}/report`,
              { type, reason },
            );
            if (!result.response.ok) {
              setNotice({ text: resourceReviewError(locale, result.value?.code), error: true });
              return;
            }
            if (!confirmedReviewReport(result.value)) throw new Error("Unconfirmed report");
            setId(result.value.id);
            setNotice({ text: copy.reportSaved, error: false });
          } catch {
            setNotice({ text: copy.unknown, error: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          {copy.reportType}
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            disabled={busy || !!id}
            className={`${nativeFieldClass} ml-3 p-2`}
          >
            {(["spam", "abuse", "copyright", "other"] as const).map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-label={copy.reason}
          minLength={10}
          maxLength={1000}
          required
          disabled={busy || !!id}
          className={`${nativeFieldClass} block min-h-24 w-full p-3`}
        />
        <Button type="submit" size="touch" disabled={busy || !!id} isLoading={busy}>
          {busy ? copy.busy : copy.send}
        </Button>
      </form>
      {notice?.error ? <ErrorState id="resource-review-report-error" title={notice.text} /> : null}
      {notice && !notice.error ? <p role="status">{notice.text}</p> : null}
      {id ? (
        <Link
          href={`/workspace/review-reports/${encodeURIComponent(id)}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.detail}
        </Link>
      ) : (
        <Link
          href="/workspace/review-reports"
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.reports}
        </Link>
      )}
    </details>
  );
}
export function ResourceReviewDecisionForm({
  id,
  status,
  revision,
  reviewText,
  locale,
}: {
  id: string;
  status: string;
  revision: number | null;
  reviewText?: string | null;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale),
    [notes, setNotes] = useState(""),
    [action, setAction] = useState<ResourceReviewDecisionAction>("review"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<Notice | null>(null),
    [confirmed, setConfirmed] = useState(false);
  async function submitDecision() {
    if (busy || confirmed) return;
    if (isDestructiveResourceReviewDecision(action)) {
      const object = reviewConfirmObject(reviewText ?? "", copy.text);
      if (
        !(await confirmAction({
          title: copy.removeReviewConfirmTitle,
          object,
          consequences: copy.removeReviewConfirm,
          confirmLabel: copy.remove_review,
          cancelLabel: copy.cancel,
          closeLabel: copy.cancel,
          danger: true,
        }))
      )
        return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await post(`/api/admin/commerce/reviews/${encodeURIComponent(id)}`, {
        action,
        expectedStatus: status,
        notes,
        ...(action === "remove_review" ? { expectedRevision: revision } : {}),
      });
      if (!result.response.ok) {
        setNotice({ text: resourceReviewError(locale, result.value?.code), error: true });
        return;
      }
      if (!confirmedReviewDecision(result.value, id, action))
        throw new Error("Unconfirmed decision");
      setConfirmed(true);
      setNotice({ text: copy.saved, error: false });
    } catch {
      setNotice({ text: copy.unknown, error: true });
    } finally {
      setBusy(false);
    }
  }
  if (status !== "open" && status !== "under_review") return null;
  return (
    <form
      className="nexus-panel space-y-3 p-5"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        void submitDecision();
      }}
    >
      <label className="block text-sm">
        {copy.decide}
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as ResourceReviewDecisionAction)}
          disabled={busy || confirmed}
          className={`${nativeFieldClass} ml-3 p-2`}
        >
          {(
            [
              "review",
              "resolve",
              "dismiss",
              ...(revision !== null ? ["remove_review" as const] : []),
            ] as const
          ).map((value) => (
            <option key={value} value={value}>
              {copy[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        {copy.notes}
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          required
          minLength={3}
          maxLength={2000}
          disabled={busy || confirmed}
          className={`${nativeFieldClass} mt-2 block min-h-24 w-full p-3`}
        />
      </label>
      <Button type="submit" size="touch" disabled={busy || confirmed} isLoading={busy}>
        {busy ? copy.busy : copy.decide}
      </Button>
      {notice?.error ? (
        <ErrorState id="resource-review-decision-error" title={notice.text} />
      ) : null}
      {notice && !notice.error ? <p role="status">{notice.text}</p> : null}
      <Recovery locale={locale} />
    </form>
  );
}
