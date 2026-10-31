"use client";

import { Button, fieldClassBlock } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { confirmedServerReview } from "../lib/server-review-confirmation";
import { serverReviewCopy, serverReviewError, serverReviewState } from "../lib/server-review-i18n";
import { useNexusLocale } from "./locale-context";

type Review = {
  id: string;
  text: string;
  rating: number;
  status: "published" | "withdrawn" | "removed";
  revision: number;
  interactionSource: "follow";
  moderationReason?: string | null;
  author?: { username: string; displayName: string } | null;
};

type PublicPage = {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
};

export function ServerReviewPanel({
  serverId,
  initialPage,
}: {
  serverId: string;
  initialPage: PublicPage;
}) {
  const { locale } = useNexusLocale();
  const copy = serverReviewCopy(locale);
  const [page, setPage] = useState(initialPage);
  const [mine, setMine] = useState<{
    review: (Review & { moderationReason?: string | null }) | null;
    canReview: boolean;
    eligibility: string;
  } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews/mine`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (cancelled) return;
      if (response.status === 401) {
        setSignedIn(false);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as {
        review: (Review & { moderationReason?: string | null }) | null;
        canReview: boolean;
        eligibility: string;
      };
      setSignedIn(true);
      setMine(data);
      setText(data.review?.text ?? "");
      setRating(data.review?.rating ?? 5);
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  async function submit(action: "save" | "withdraw") {
    if (busy || confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedRevision: mine?.review?.revision ?? 0,
          ...(action === "save" ? { text, rating } : {}),
        }),
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(serverReviewError(locale, value?.code));
        return;
      }
      if (!confirmedServerReview(value, mine?.review?.revision ?? 0, action)) {
        throw new Error("Unconfirmed review");
      }
      setConfirmed(true);
      setMessage(copy.saved);
      const refreshed = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/reviews?page=${page.page}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (refreshed.ok) {
        setPage((await refreshed.json()) as PublicPage);
      }
    } catch {
      setMessage(copy.unknown);
    } finally {
      setBusy(false);
    }
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    void submit("save");
  }

  return (
    <section className="space-y-5" aria-labelledby="server-reviews-heading">
      <header className="space-y-2">
        <h2 id="server-reviews-heading" className="text-base font-bold text-primary">
          {copy.title}
        </h2>
        <p className="text-xs leading-relaxed text-muted">{copy.description}</p>
      </header>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-primary">
          {copy.all} ({page.total})
        </h3>
        {page.reviews.length === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <ul className="space-y-3">
            {page.reviews.map((review) => (
              <li key={review.id} className="nexus-panel space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {copy.author}: {review.author?.displayName || review.author?.username || "—"}
                  </span>
                  <span>
                    {copy.rating}: {review.rating}/5 · {copy.follow}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-secondary">{review.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="nexus-panel space-y-4 p-5">
        <h3 className="text-sm font-semibold text-primary">{copy.write}</h3>
        {!signedIn ? (
          <Link href="/auth/login" className="text-sm text-accent underline">
            {copy.signIn}
          </Link>
        ) : (
          <>
            <p className="text-xs text-secondary">{copy.access}</p>
            {mine?.review && (
              <p className="text-xs text-muted">{serverReviewState(locale, mine.review.status)}</p>
            )}
            {mine?.review?.moderationReason && (
              <p className="text-xs text-secondary">
                {copy.reason}: {mine.review.moderationReason}
              </p>
            )}
            {mine?.eligibility === "follow_required" && (
              <p className="text-xs text-warning">{copy.followRequired}</p>
            )}
            {mine?.eligibility === "owner_conflict" && (
              <p className="text-xs text-warning">{copy.ownerConflict}</p>
            )}
            {mine?.canReview ? (
              <form className="space-y-4" onSubmit={onSave}>
                <label className="block text-sm text-secondary">
                  {copy.rating}
                  <select
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                    disabled={busy || confirmed}
                    className={`${fieldClassBlock} mt-2`}
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}/5
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-secondary">
                  {copy.text}
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    minLength={3}
                    maxLength={4000}
                    required
                    disabled={busy || confirmed}
                    className={`${fieldClassBlock} mt-2 min-h-28`}
                  />
                </label>
                <Button type="submit" disabled={busy || confirmed} isLoading={busy}>
                  {busy ? copy.busy : copy.save}
                </Button>
              </form>
            ) : (
              mine?.review && (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {mine.review.text}
                </p>
              )
            )}
            {mine?.review?.status === "published" && (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-sm text-danger underline"
                disabled={busy || confirmed}
                onClick={() => void submit("withdraw")}
              >
                {copy.withdraw}
              </Button>
            )}
          </>
        )}
        <p role="status" className="text-sm">
          {message}
        </p>
        {confirmed && (
          <button
            type="button"
            className="text-sm text-accent underline"
            onClick={() => window.location.reload()}
          >
            {copy.reload}
          </button>
        )}
      </div>
    </section>
  );
}
