"use client";

import { Button, fieldClassBlock } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { confirmedServerReview } from "../lib/server-review-confirmation";
import { serverReviewCopy, serverReviewError, serverReviewState } from "../lib/server-review-i18n";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
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

function reviewsUnavailableCopy(locale: "en" | "ru") {
  return locale === "ru"
    ? {
        unavailable: "Отзывы временно недоступны. Это не означает, что отзывов нет.",
        retry: "Повторить загрузку",
        reloadReason: "Состояние сохранено на сервере. Обновите страницу, чтобы снова изменить отзыв.",
      }
    : {
        unavailable: "Reviews are temporarily unavailable. This does not mean there are no reviews.",
        retry: "Retry loading reviews",
        reloadReason: "Your review is saved on the server. Reload to edit it again.",
      };
}

export function ServerReviewPanel({
  serverId,
  initialPage,
  loadState = "ready",
}: {
  serverId: string;
  initialPage?: PublicPage;
  loadState?: "ready" | "unavailable";
}) {
  const { locale } = useNexusLocale();
  const copy = serverReviewCopy(locale);
  const loadCopy = reviewsUnavailableCopy(locale);
  const statusId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [page, setPage] = useState<PublicPage | null>(initialPage ?? null);
  const [unavailable, setUnavailable] = useState(
    loadState === "unavailable" || initialPage == null,
  );
  const [retrying, setRetrying] = useState(false);
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
  const [loginHref, setLoginHref] = useState("/auth/login");

  const refreshMine = useCallback(async () => {
    const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews/mine`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401) {
      setSignedIn(false);
      setMine(null);
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
    if (!confirmed) {
      setText(data.review?.text ?? "");
      setRating(data.review?.rating ?? 5);
    }
  }, [serverId, confirmed]);

  useEffect(() => {
    setLoginHref(authEntryHref("login", currentBrowserReturnPath()));
    let cancelled = false;
    void refreshMine().then(() => {
      if (cancelled) return;
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshMine();
    };
    const onFocus = () => {
      void refreshMine();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshMine]);

  useEffect(() => {
    if (!message && !unavailable) return;
    statusRef.current?.focus();
  }, [message, unavailable, confirmed]);

  async function retryLoad() {
    if (retrying) return;
    setRetrying(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/reviews?page=${page?.page ?? 1}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Reviews unavailable");
      const next = (await response.json()) as PublicPage;
      if (!Array.isArray(next.reviews) || !Number.isFinite(next.total)) {
        throw new Error("Invalid review page");
      }
      setPage(next);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
      setMessage(loadCopy.unavailable);
    } finally {
      setRetrying(false);
    }
  }

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
      setMine((previous) => ({
        canReview: previous?.canReview ?? false,
        eligibility: previous?.eligibility ?? "ok",
        review: {
          id: value.id,
          text: action === "save" ? text : (previous?.review?.text ?? text),
          rating: action === "save" ? rating : (previous?.review?.rating ?? rating),
          status: value.status as Review["status"],
          revision: value.revision,
          interactionSource: "follow",
          moderationReason: previous?.review?.moderationReason ?? null,
          author: previous?.review?.author ?? null,
        },
      }));
      setMessage(`${copy.saved}. ${loadCopy.reloadReason}`);
      const refreshed = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/reviews?page=${page?.page ?? 1}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (refreshed.ok) {
        setPage((await refreshed.json()) as PublicPage);
        setUnavailable(false);
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

      {unavailable || !page ? (
        <div className="nexus-panel space-y-3 p-5" role="alert">
          <p className="text-sm text-warning">{loadCopy.unavailable}</p>
          <Button
            type="button"
            variant="secondary"
            disabled={retrying}
            isLoading={retrying}
            onClick={() => void retryLoad()}
          >
            {retrying ? copy.busy : loadCopy.retry}
          </Button>
        </div>
      ) : (
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
      )}

      <div className="nexus-panel space-y-4 p-5">
        <h3 className="text-sm font-semibold text-primary">{copy.write}</h3>
        {!signedIn ? (
          <Link href={loginHref} className="text-sm text-accent underline">
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
            {mine?.eligibility === "moderated" && (
              <p className="text-xs text-warning">{copy.moderated}</p>
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
        <p
          ref={statusRef}
          id={statusId}
          role="status"
          tabIndex={-1}
          className="text-sm outline-none"
        >
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
