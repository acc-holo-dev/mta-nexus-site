"use client";

import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { getDictionary } from "../../../lib/i18n";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authEntryHref, currentBrowserReturnPath } from "../../shell/auth-return";
import { confirmAction } from "../../shell/confirm-action";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { linkGhostUnderlineFocus } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace2P4TextSm, panelSpace4P5 } from "../../shell/panel-shell";
import {
  typeBlockSmSecondary,
  typePrewrapBreak,
  typePrewrapBreakSecondary,
  typePrewrapSmSecondary,
  typeSmSemiboldPrimary,
  typeSpace2Sm,
  typeXsLeadingMuted,
  typeXsMuted,
  typeXsSecondary,
} from "../../shell/type-shell";
import { confirmedServerReview } from "../server-review-confirmation";
import {
  serverReviewCopy,
  serverReviewError,
  serverReviewLoadCopy,
  serverReviewState,
} from "../server-review-i18n";

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

type Notice = { text: string; error: boolean };

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
  const pathname = usePathname();
  const router = useRouter();
  const dictionary = getDictionary(locale);
  const workspace = dictionary.workspace;
  const formErrorHint = dictionary.errors.formErrorHint;
  const copy = serverReviewCopy(locale);
  const loadCopy = serverReviewLoadCopy(locale);
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  const draftDirty = useRef(false);
  const draftRevision = useRef(0);
  const mineRequest = useRef(0);
  const reviewServer = useRef(serverId);
  const scopeGeneration = useRef(0);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<{ review: Review | null; canReview: boolean } | null>(null);
  const [checkingLatest, setCheckingLatest] = useState(false);

  const refreshMine = useCallback(async () => {
    const generation = ++mineRequest.current;
    try {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews/mine`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (generation !== mineRequest.current) return;
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
      if (generation !== mineRequest.current) return;
      setSignedIn(true);
      setMine(data);
      if (!confirmed && !draftDirty.current) {
        draftRevision.current = data.review?.revision ?? 0;
        setText(data.review?.text ?? "");
        setRating(data.review?.rating ?? 5);
      }
    } catch {
      // Keep the last confirmed data and the draft when a background refresh fails.
    }
  }, [serverId, confirmed]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);

  useEffect(() => {
    if (reviewServer.current !== serverId) {
      reviewServer.current = serverId;
      draftDirty.current = false;
      draftRevision.current = 0;
      setMine(null);
      setSignedIn(false);
      setPage(initialPage ?? null);
      setUnavailable(loadState === "unavailable" || initialPage == null);
      setConfirmed(false);
      setNotice(null);
      setBusy(false);
      setRetrying(false);
      setConflict(false);
      setLatest(null);
      setCheckingLatest(false);
    }
    void refreshMine();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshMine();
    };
    const onFocus = () => {
      void refreshMine();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      mineRequest.current += 1;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshMine, serverId, initialPage, loadState]);

  // biome-ignore lint/correctness/useExhaustiveDependencies(serverId): Invalidate old mutations when the server changes.
  useEffect(() => {
    return () => {
      scopeGeneration.current += 1;
    };
  }, [serverId]);

  useEffect(() => {
    if (!notice || notice.error) return;
    statusRef.current?.focus();
  }, [notice]);

  async function retryLoad() {
    if (retrying) return;
    setRetrying(true);
    setNotice(null);
    const scope = scopeGeneration.current;
    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/reviews?page=${page?.page ?? 1}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) throw new Error("Reviews unavailable");
      const next = (await response.json()) as PublicPage;
      if (scope !== scopeGeneration.current) return;
      if (!Array.isArray(next.reviews) || !Number.isFinite(next.total)) {
        throw new Error("Invalid review page");
      }
      setPage(next);
      setUnavailable(false);
    } catch {
      if (scope !== scopeGeneration.current) return;
      setUnavailable(true);
    } finally {
      if (scope === scopeGeneration.current) setRetrying(false);
    }
  }

  async function submit(action: "save" | "withdraw") {
    if (busy || confirmed || (action === "save" && conflict)) return;
    const scope = scopeGeneration.current;
    setBusy(true);
    setNotice(null);
    mineRequest.current += 1;
    const expectedRevision =
      action === "save" ? draftRevision.current : (mine?.review?.revision ?? 0);
    try {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedRevision,
          ...(action === "save" ? { text, rating } : {}),
        }),
      });
      const value = await response.json().catch(() => null);
      if (scope !== scopeGeneration.current) return;
      if (!response.ok) {
        if (action === "save" && value?.code === "REVIEW_CHANGED") {
          setConflict(true);
          setLatest(null);
        }
        setNotice({ text: serverReviewError(locale, value?.code), error: true });
        return;
      }
      if (!confirmedServerReview(value, expectedRevision, action)) {
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
      setNotice({ text: `${copy.saved}. ${loadCopy.reloadReason}`, error: false });
      try {
        const refreshed = await fetch(
          `/api/servers/${encodeURIComponent(serverId)}/reviews?page=${page?.page ?? 1}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!refreshed.ok) throw new Error("Reviews unavailable");
        const next = (await refreshed.json()) as PublicPage;
        if (scope !== scopeGeneration.current) return;
        setPage(next);
        setUnavailable(false);
      } catch {
        if (scope === scopeGeneration.current) setUnavailable(true);
      }
    } catch {
      if (scope === scopeGeneration.current) setNotice({ text: copy.unknown, error: true });
    } finally {
      if (scope === scopeGeneration.current) setBusy(false);
    }
  }

  async function checkLatest() {
    if (checkingLatest) return;
    const scope = scopeGeneration.current;
    setCheckingLatest(true);
    setLatest(null);
    try {
      const response = await fetch(`/api/servers/${encodeURIComponent(serverId)}/reviews/mine`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const value = await response.json().catch(() => null);
      if (scope !== scopeGeneration.current) return;
      if (
        !response.ok ||
        typeof value?.canReview !== "boolean" ||
        !(
          value.review === null ||
          (Number.isSafeInteger(value.review?.revision) &&
            typeof value.review?.text === "string" &&
            Number.isFinite(value.review?.rating))
        )
      )
        throw new Error("Invalid review state");
      setLatest({ review: value.review, canReview: value.canReview });
      setNotice({ text: copy.changed, error: true });
    } catch {
      if (scope === scopeGeneration.current)
        setNotice({ text: copy.latestUnavailable, error: true });
    } finally {
      if (scope === scopeGeneration.current) setCheckingLatest(false);
    }
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    void submit("save");
  }

  async function withdrawReview() {
    if (busy || confirmed) return;
    const scope = scopeGeneration.current;
    const source = (mine?.review?.text ?? text).trim();
    const object =
      source.length > 80 ? `${source.slice(0, 80)}…` : source.length > 0 ? source : copy.text;
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
    if (scope !== scopeGeneration.current) return;
    void submit("withdraw");
  }

  return (
    <section className="space-y-5" aria-labelledby="server-reviews-heading">
      <header className="space-y-2">
        <h2 id="server-reviews-heading" className="text-base font-bold text-primary">
          {copy.title}
        </h2>
        <p className={typeXsLeadingMuted}>{copy.description}</p>
      </header>

      {unavailable || !page ? (
        <ErrorState
          title={loadCopy.unavailable}
          description={loadCopy.unavailableHint}
          action={
            <Button
              type="button"
              variant="secondary"
              size="touch"
              disabled={retrying}
              isLoading={retrying}
              onClick={() => void retryLoad()}
            >
              {retrying ? copy.busy : loadCopy.retry}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <h3 className={typeSmSemiboldPrimary}>
            {copy.all} ({page.total})
          </h3>
          {page.reviews.length === 0 ? (
            <EmptyState title={copy.empty} description={copy.emptyHint} />
          ) : (
            <ul className="space-y-3">
              {page.reviews.map((review) => (
                <li key={review.id} className={panelSpace2P4TextSm}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {copy.author}:{" "}
                      {formatUnknown(locale, review.author?.displayName || review.author?.username)}
                    </span>
                    <span>
                      {copy.rating}: {review.rating}/5 · {copy.follow}
                    </span>
                  </div>
                  <p className={typePrewrapBreakSecondary}>{review.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={panelSpace4P5}>
        <h3 className={typeSmSemiboldPrimary}>{copy.write}</h3>
        {!signedIn ? (
          <GuestAuthLinks
            loginHref={loginHref}
            registerHref={registerHref}
            signInLabel={copy.signIn}
            createAccountLabel={workspace.createAccount}
          />
        ) : (
          <>
            <p className={typeXsSecondary}>{copy.access}</p>
            {mine?.review && (
              <p className={typeXsMuted}>{serverReviewState(locale, mine.review.status)}</p>
            )}
            {mine?.review?.moderationReason && (
              <p className={typeXsSecondary}>
                {copy.reason}: {mine.review.moderationReason}
              </p>
            )}
            {mine?.eligibility === "follow_required" && (
              <ErrorState
                id="server-review-eligibility-follow-required"
                title={copy.followRequired}
                description={formErrorHint}
              />
            )}
            {mine?.eligibility === "owner_conflict" && (
              <ErrorState
                id="server-review-eligibility-owner-conflict"
                title={copy.ownerConflict}
                description={formErrorHint}
              />
            )}
            {mine?.eligibility === "moderated" && (
              <ErrorState
                id="server-review-eligibility-moderated"
                title={copy.moderated}
                description={formErrorHint}
              />
            )}
            {mine?.canReview ? (
              <form className="space-y-4" onSubmit={onSave}>
                <label className={typeBlockSmSecondary}>
                  {copy.rating}
                  <select
                    value={rating}
                    onChange={(event) => {
                      draftDirty.current = true;
                      setRating(Number(event.target.value));
                    }}
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
                <label className={typeBlockSmSecondary}>
                  {copy.text}
                  <textarea
                    value={text}
                    onChange={(event) => {
                      draftDirty.current = true;
                      setText(event.target.value);
                    }}
                    minLength={3}
                    maxLength={4000}
                    required
                    disabled={busy || confirmed}
                    className={`${fieldClassBlock} mt-2 min-h-28`}
                  />
                </label>
                <Button
                  type="submit"
                  size="touch"
                  disabled={busy || confirmed || conflict}
                  isLoading={busy}
                >
                  {busy ? copy.busy : copy.save}
                </Button>
              </form>
            ) : (
              mine?.review && <p className={typePrewrapSmSecondary}>{mine.review.text}</p>
            )}
            {mine?.review?.status === "published" && (
              <Button
                type="button"
                variant="ghost"
                className={`${linkGhostUnderlineFocus} text-danger`}
                disabled={busy || confirmed}
                onClick={() => void withdrawReview()}
              >
                {copy.withdraw}
              </Button>
            )}
          </>
        )}
        {notice?.error ? (
          <ErrorState
            id="server-review-write-error"
            title={notice.text}
            description={formErrorHint}
            action={
              <Button
                type="button"
                variant="ghost"
                className={`${linkGhostUnderlineFocus} text-accent`}
                onClick={() => router.refresh()}
              >
                {copy.reload}
              </Button>
            }
          />
        ) : null}
        {notice && !notice.error ? (
          <p
            ref={statusRef}
            id={statusId}
            role="status"
            tabIndex={-1}
            className="text-sm outline-none"
          >
            {notice.text}
          </p>
        ) : null}
        {conflict && (
          <div className={typeSpace2Sm}>
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={checkingLatest}
              onClick={() => void checkLatest()}
            >
              {copy.checkLatest}
            </Button>
            {latest && (
              <div className="space-y-2">
                <p className="font-semibold">{copy.latestReview}</p>
                {latest.review ? (
                  <p className={typePrewrapBreak}>
                    {copy.rating}: {latest.review.rating}/5 · {latest.review.text}
                  </p>
                ) : (
                  <EmptyState title={copy.noLatestReview} description={copy.noLatestReviewHint} />
                )}
                {latest.canReview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="touch"
                    onClick={() => {
                      draftRevision.current = latest.review?.revision ?? 0;
                      setConflict(false);
                      setLatest(null);
                      setNotice(null);
                    }}
                  >
                    {copy.useLatest}
                  </Button>
                )}
                {!latest.canReview && <p>{copy.latestNotEditable}</p>}
              </div>
            )}
          </div>
        )}
        {confirmed && (
          <Button
            type="button"
            variant="ghost"
            className={`${linkGhostUnderlineFocus} text-accent`}
            onClick={() => router.refresh()}
          >
            {copy.reload}
          </Button>
        )}
      </div>
    </section>
  );
}
