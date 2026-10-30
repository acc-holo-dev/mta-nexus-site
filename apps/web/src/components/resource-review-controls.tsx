"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@nexus/ui";
import type { Locale } from "../lib/i18n";
import {
  resourceReviewCopy,
  resourceReviewError,
  resourceReviewState,
} from "../lib/resource-review-i18n";
import {
  confirmedReview,
  confirmedReviewDecision,
  confirmedReviewReport,
} from "../lib/resource-review-confirmation";
type Review = {
  text: string;
  rating: number | null;
  status: string;
  revision: number;
  moderationReason?: string | null;
};
function Recovery({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      className="text-sm text-accent underline"
      onClick={() => window.location.reload()}
    >
      {resourceReviewCopy(locale).reload}
    </button>
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
export function ResourceReviewEditor({
  productId,
  review,
  canReview,
  locale,
}: {
  productId: string;
  review: Review | null;
  canReview: boolean;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale);
  const [text, setText] = useState(review?.text ?? ""),
    [rating, setRating] = useState(review?.rating ?? 5),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  async function submit(action: "save" | "withdraw") {
    if (busy || confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await post(`/api/library/review/${encodeURIComponent(productId)}`, {
        action,
        expectedRevision: review?.revision ?? 0,
        ...(action === "save" ? { text, rating } : {}),
      });
      if (!result.response.ok) {
        setMessage(resourceReviewError(locale, result.value?.code));
        return;
      }
      if (!confirmedReview(result.value, review?.revision ?? 0, action))
        throw new Error("Unconfirmed review");
      setConfirmed(true);
      setMessage(copy.saved);
    } catch {
      setMessage(copy.unknown);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="nexus-panel space-y-4 p-5">
      <p className="text-sm text-secondary">{copy.access}</p>
      {review && <p>{resourceReviewState(locale, review.status)}</p>}
      {review?.moderationReason && (
        <p className="text-sm text-secondary">
          {copy.reason}: {review.moderationReason}
        </p>
      )}
      {canReview ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("save");
          }}
        >
          <label className="block text-sm">
            {copy.rating}
            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              disabled={busy || confirmed}
              className="ml-3 rounded border border-base bg-surface p-2"
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
              value={text}
              onChange={(event) => setText(event.target.value)}
              minLength={3}
              maxLength={4000}
              required
              disabled={busy || confirmed}
              className="mt-2 block min-h-36 w-full rounded border border-base bg-surface p-3"
            />
          </label>
          <Button type="submit" disabled={busy || confirmed} isLoading={busy}>
            {busy ? copy.busy : copy.save}
          </Button>
        </form>
      ) : (
        review && <p className="whitespace-pre-wrap break-words text-sm">{review.text}</p>
      )}
      {review?.status === "published" && (
        <button
          type="button"
          className="text-sm text-danger underline"
          disabled={busy || confirmed}
          onClick={() => void submit("withdraw")}
        >
          {copy.withdraw}
        </button>
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
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
    [message, setMessage] = useState(""),
    [id, setId] = useState<string | null>(null);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">{copy.report}</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || id) return;
          setBusy(true);
          setMessage("");
          try {
            const result = await post(
              `/api/products/${encodeURIComponent(productId)}/reviews/${encodeURIComponent(reviewId)}/report`,
              { type, reason },
            );
            if (!result.response.ok) {
              setMessage(resourceReviewError(locale, result.value?.code));
              return;
            }
            if (!confirmedReviewReport(result.value)) throw new Error("Unconfirmed report");
            setId(result.value.id);
            setMessage(copy.reportSaved);
          } catch {
            setMessage(copy.unknown);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          {copy.reason}
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            disabled={busy || !!id}
            className="ml-3 rounded border border-base bg-surface p-2"
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
          className="block min-h-24 w-full rounded border border-base bg-surface p-3"
        />
        <Button type="submit" disabled={busy || !!id} isLoading={busy}>
          {busy ? copy.busy : copy.send}
        </Button>
      </form>
      <p role="status">{message}</p>
      {id ? (
        <Link
          href={`/workspace/review-reports/${encodeURIComponent(id)}`}
          className="text-accent underline"
        >
          {copy.detail}
        </Link>
      ) : (
        <Link href="/workspace/review-reports" className="text-accent underline">
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
  locale,
}: {
  id: string;
  status: string;
  revision: number | null;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale),
    [notes, setNotes] = useState(""),
    [action, setAction] = useState("review"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  if (status !== "open" && status !== "under_review") return null;
  return (
    <form
      className="nexus-panel space-y-3 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || confirmed) return;
        setBusy(true);
        setMessage("");
        try {
          const result = await post(`/api/admin/commerce/reviews/${encodeURIComponent(id)}`, {
            action,
            expectedStatus: status,
            notes,
            ...(action === "remove_review" ? { expectedRevision: revision } : {}),
          });
          if (!result.response.ok) {
            setMessage(resourceReviewError(locale, result.value?.code));
            return;
          }
          if (!confirmedReviewDecision(result.value, id, action))
            throw new Error("Unconfirmed decision");
          setConfirmed(true);
          setMessage(copy.saved);
        } catch {
          setMessage(copy.unknown);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        {copy.decide}
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          disabled={busy || confirmed}
          className="ml-3 rounded border border-base bg-surface p-2"
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
          className="mt-2 block min-h-24 w-full rounded border border-base bg-surface p-3"
        />
      </label>
      <Button type="submit" disabled={busy || confirmed} isLoading={busy}>
        {busy ? copy.busy : copy.decide}
      </Button>
      <p role="status">{message}</p>
      <Recovery locale={locale} />
    </form>
  );
}
