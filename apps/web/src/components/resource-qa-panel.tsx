"use client";

import type {
  ResourceQaCapabilities,
  ResourceQaThreadDetail,
  ResourceQaThreadSummary,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { CircleHelp, MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { getDictionary } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { resourceQaCopy, resourceQaError } from "../lib/resource-qa-i18n";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { confirmAction } from "./confirm-action";
import { GuestAuthLinks } from "./guest-auth-links";

type BuildOption = { id: string; version: string };

type PagePayload = {
  threads: ResourceQaThreadSummary[];
  capabilities: ResourceQaCapabilities;
  page?: number;
  total?: number;
};

type DetailPayload = {
  thread: ResourceQaThreadDetail;
  capabilities: ResourceQaCapabilities;
};

const shellClass = "nexus-panel min-w-0 space-y-4 overflow-x-clip p-6";
const ghostActionClass =
  "h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const textActionClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function readCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function ResourceQaPanel({
  productId,
  locale,
  authenticated,
  canManage,
  initial,
  builds,
}: {
  productId: string;
  locale: Locale;
  authenticated: boolean;
  canManage: boolean;
  initial: PagePayload | null;
  builds: BuildOption[];
}) {
  const copy = resourceQaCopy(locale);
  const [page, setPage] = useState<PagePayload | null>(initial);
  const [readError, setReadError] = useState(initial ? "" : copy.unavailable);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [question, setQuestion] = useState("");
  const [buildId, setBuildId] = useState("");
  const [answer, setAnswer] = useState("");
  const [writeError, setWriteError] = useState("");
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const workspaceCopy = getDictionary(locale).workspace;
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  const writeGuard = useRef(false);
  const base = `/api/products/${encodeURIComponent(productId)}/qa`;

  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);

  const capabilities = detail?.capabilities ?? page?.capabilities;
  const canAsk = Boolean(capabilities?.canAsk);
  const canAnswer = Boolean(capabilities?.canAnswer || canManage);
  const canResolve = Boolean(capabilities?.canResolve || canManage);

  async function loadPage() {
    setLoadingPage(true);
    setWriteError("");
    setReadError("");
    try {
      const response = await fetch(base, privateApiRequest({ timeoutMs: 15_000 })).catch(
        () => null,
      );
      const payload: unknown = response ? await response.json().catch(() => null) : null;
      if (!response?.ok || !payload || typeof payload !== "object") {
        setPage(null);
        setReadError(
          response ? resourceQaError(locale, readCode(payload) ?? "UNCONFIRMED") : copy.unavailable,
        );
        return;
      }
      setPage(payload as PagePayload);
      setPendingThreadId(null);
    } finally {
      setLoadingPage(false);
    }
  }

  async function loadThread(threadId: string) {
    setLoadingDetail(true);
    setPendingThreadId(threadId);
    setWriteError("");
    setReadError("");
    try {
      const response = await fetch(
        `${base}/${encodeURIComponent(threadId)}`,
        privateApiRequest({ timeoutMs: 15_000 }),
      ).catch(() => null);
      const payload: unknown = response ? await response.json().catch(() => null) : null;
      if (!response?.ok) {
        setDetail(null);
        setReadError(resourceQaError(locale, readCode(payload) ?? "UNCONFIRMED"));
        return;
      }
      setDetail(payload as DetailPayload);
      setSelectedId(threadId);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function mutate(path: string, body: unknown, expected: (payload: unknown) => boolean) {
    if (writeGuard.current) return false;
    writeGuard.current = true;
    setBusy(true);
    setWriteError("");
    try {
      const response = await fetch(
        path,
        privateApiRequest({
          method: "POST",
          timeoutMs: 15_000,
          json: body,
        }),
      ).catch(() => null);
      const payload: unknown = response ? await response.json().catch(() => null) : null;
      if (!response?.ok || !expected(payload)) {
        const code =
          response?.status === 401
            ? "UNAUTHORIZED"
            : (readCode(payload) ?? (response ? "UNCONFIRMED" : "UNCONFIRMED"));
        setWriteError(resourceQaError(locale, code));
        return false;
      }
      return true;
    } finally {
      writeGuard.current = false;
      setBusy(false);
    }
  }

  async function onAsk(event: FormEvent) {
    event.preventDefault();
    const body = question.trim();
    if (body.length < 3) return;
    const ok = await mutate(base, { body, buildId: buildId || null }, (payload) =>
      Boolean(
        payload &&
          typeof payload === "object" &&
          (payload as { success?: boolean; id?: string }).success &&
          typeof (payload as { id?: string }).id === "string",
      ),
    );
    if (!ok) return;
    const text = question;
    setQuestion("");
    setBuildId("");
    const refresh = await fetch(base, privateApiRequest({ timeoutMs: 15_000 })).catch(() => null);
    const payload: unknown = refresh ? await refresh.json().catch(() => null) : null;
    if (refresh?.ok && payload && typeof payload === "object") {
      setPage(payload as PagePayload);
    } else {
      setPage((current) =>
        current
          ? {
              ...current,
              threads: [
                {
                  id: "local",
                  body: text,
                  status: "open",
                  revision: 1,
                  answerCount: 0,
                  buildContext: null,
                  resolvedAnswerId: null,
                  createdAt: new Date(),
                  updatedAt: null,
                  author: null,
                },
                ...current.threads,
              ],
            }
          : current,
      );
      setWriteError(copy.unknown);
    }
  }

  async function onAnswer(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const body = answer.trim();
    if (body.length < 3) return;
    const ok = await mutate(
      `${base}/${encodeURIComponent(detail.thread.id)}/answers`,
      { body, expectedThreadRevision: detail.thread.revision },
      (payload) =>
        Boolean(
          payload &&
            typeof payload === "object" &&
            (payload as { success?: boolean; answerId?: string }).success &&
            typeof (payload as { answerId?: string }).answerId === "string",
        ),
    );
    if (!ok) return;
    setAnswer("");
    await loadThread(detail.thread.id);
  }

  async function onResolve(answerId: string) {
    if (!detail) return;
    if (
      !(await confirmAction({
        title: copy.resolveConfirmTitle,
        object: detail.thread.body,
        consequences: copy.resolveConfirm,
        confirmLabel: copy.resolve,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: false,
      }))
    )
      return;
    const ok = await mutate(
      `${base}/${encodeURIComponent(detail.thread.id)}/resolve`,
      {
        action: "resolve",
        answerId,
        expectedRevision: detail.thread.revision,
      },
      (payload) =>
        Boolean(
          payload &&
            typeof payload === "object" &&
            (payload as { success?: boolean; status?: string }).success &&
            (payload as { status?: string }).status === "resolved",
        ),
    );
    if (ok) await loadThread(detail.thread.id);
  }

  async function onReopen() {
    if (!detail) return;
    if (
      !(await confirmAction({
        title: copy.reopenConfirmTitle,
        object: detail.thread.body,
        consequences: copy.reopenConfirm,
        confirmLabel: copy.reopen,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    const ok = await mutate(
      `${base}/${encodeURIComponent(detail.thread.id)}/resolve`,
      { action: "reopen", expectedRevision: detail.thread.revision },
      (payload) =>
        Boolean(
          payload &&
            typeof payload === "object" &&
            (payload as { success?: boolean; status?: string }).success &&
            (payload as { status?: string }).status === "open",
        ),
    );
    if (ok) await loadThread(detail.thread.id);
  }

  async function onFollow(enabled: boolean) {
    if (!detail) return;
    if (
      !enabled &&
      !(await confirmAction({
        title: copy.unfollowConfirmTitle,
        object: detail.thread.body,
        consequences: copy.unfollowConfirm,
        confirmLabel: copy.unfollow,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: true,
      }))
    )
      return;
    const ok = await mutate(
      `${base}/${encodeURIComponent(detail.thread.id)}/follow`,
      {
        action: enabled ? "follow" : "unfollow",
        expectedRevision: detail.thread.followRevision,
      },
      (payload) =>
        Boolean(
          payload &&
            typeof payload === "object" &&
            (payload as { success?: boolean; following?: boolean }).success &&
            (payload as { following?: boolean }).following === enabled,
        ),
    );
    if (ok) await loadThread(detail.thread.id);
  }

  function retryRead() {
    if (pendingThreadId) {
      void loadThread(pendingThreadId);
      return;
    }
    void loadPage();
  }

  return (
    <section
      className={shellClass}
      data-testid="resource-qa-panel"
      aria-busy={loadingDetail || loadingPage || undefined}
    >
      <div className="min-w-0 space-y-1 border-b border-base pb-3">
        <h2 className="min-w-0 break-words text-base font-bold text-primary">{copy.title}</h2>
        <p className="text-xs text-muted">{copy.help}</p>
      </div>

      {readError ? (
        <ErrorState
          title={readError}
          description={copy.unavailableDescription}
          action={
            <Button
              type="button"
              variant="ghost"
              className={ghostActionClass}
              disabled={busy || loadingDetail || loadingPage}
              onClick={retryRead}
            >
              {copy.retry}
            </Button>
          }
        />
      ) : null}
      {writeError ? <ErrorState title={writeError} /> : null}

      {selectedId && detail ? (
        <div className="min-w-0 space-y-4 overflow-x-clip">
          <button
            type="button"
            className={textActionClass}
            onClick={() => {
              setSelectedId(null);
              setDetail(null);
              setPendingThreadId(null);
              setReadError("");
            }}
          >
            {copy.back}
          </button>
          <article className="min-w-0 space-y-2 overflow-x-clip rounded-lg border border-base bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase text-muted">
              <span>{detail.thread.status === "resolved" ? copy.resolved : copy.open}</span>
              {detail.thread.buildContext ? (
                <span>
                  {copy.buildContext}: {detail.thread.buildContext.version}
                  {!detail.thread.buildContext.available ? ` · ${copy.buildUnavailable}` : ""}
                </span>
              ) : null}
            </div>
            <p className="break-words text-sm text-secondary">{detail.thread.body}</p>
            <p className="text-xs text-faint">
              {detail.thread.author?.displayName ?? detail.thread.author?.username ?? "—"}
            </p>
          </article>

          {authenticated ? (
            <div className="space-y-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11"
                disabled={busy}
                onClick={() => void onFollow(!detail.thread.following)}
              >
                {detail.thread.following ? copy.unfollow : copy.follow}
              </Button>
              <p className="text-[11px] text-faint">{copy.followingHelp}</p>
            </div>
          ) : null}

          <div className="min-w-0 space-y-3 overflow-x-clip">
            {detail.thread.answers.length === 0 ? (
              <EmptyState
                title={copy.noAnswers}
                description={copy.noAnswersHint}
                icon={<MessageCircle className="h-6 w-6" aria-hidden="true" />}
              />
            ) : (
              detail.thread.answers.map((item) => (
                <article
                  key={item.id}
                  className={`min-w-0 space-y-2 overflow-x-clip rounded-lg border p-3 ${
                    item.isResolved
                      ? "border-[color:var(--nexus-success)]/30 bg-success-soft"
                      : "border-base bg-surface"
                  }`}
                >
                  <p className="break-words text-sm text-secondary">{item.body}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-faint">
                    <span>{item.author?.displayName ?? item.author?.username ?? "—"}</span>
                    {item.isResolved ? <span>{copy.resolved}</span> : null}
                    {canResolve && detail.thread.status !== "resolved" ? (
                      <button
                        type="button"
                        className={textActionClass}
                        disabled={busy}
                        onClick={() => void onResolve(item.id)}
                      >
                        {copy.resolve}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>

          {canResolve && detail.thread.status === "resolved" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => void onReopen()}
            >
              {copy.reopen}
            </Button>
          ) : null}

          {canAnswer ? (
            <form className="min-w-0 space-y-2" onSubmit={onAnswer}>
              <label className="block min-w-0 space-y-1 text-xs text-muted">
                <span>{copy.answer}</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-secondary"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  maxLength={4000}
                  placeholder={copy.answerPlaceholder}
                  disabled={busy}
                />
              </label>
              <Button
                type="submit"
                size="sm"
                className="min-h-11"
                disabled={busy || answer.trim().length < 3}
              >
                {busy ? copy.answering : copy.answer}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0 space-y-4 overflow-x-clip">
          {!authenticated ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">{copy.publicRead}</p>
              <GuestAuthLinks
                loginHref={loginHref}
                registerHref={registerHref}
                signInLabel={copy.signIn}
                createAccountLabel={workspaceCopy.createAccount}
              />
            </div>
          ) : capabilities?.askReason === "access_required" ? (
            <p className="text-xs text-muted">{copy.accessRequired}</p>
          ) : canAsk ? (
            <form className="min-w-0 space-y-2" onSubmit={onAsk}>
              <label className="block min-w-0 space-y-1 text-xs text-muted">
                <span>{copy.ask}</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-secondary"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={4000}
                  placeholder={copy.placeholder}
                  disabled={busy}
                />
              </label>
              {builds.length > 0 ? (
                <label className="block min-w-0 space-y-1 text-xs text-muted">
                  <span>{copy.optionalBuild}</span>
                  <select
                    className="min-h-11 w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-secondary"
                    value={buildId}
                    onChange={(event) => setBuildId(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">{copy.noBuild}</option>
                    {builds.map((build) => (
                      <option key={build.id} value={build.id}>
                        {build.version}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button
                type="submit"
                size="sm"
                className="min-h-11"
                disabled={busy || question.trim().length < 3}
              >
                {busy ? copy.asking : copy.ask}
              </Button>
            </form>
          ) : !readError ? (
            <p className="text-xs text-muted">{copy.unavailable}</p>
          ) : null}

          {loadingDetail ? (
            <p role="status" className="text-xs text-faint">
              {copy.loadingThread}
            </p>
          ) : null}

          {!readError && (!page || page.threads.length === 0) ? (
            <EmptyState
              title={copy.empty}
              description={copy.emptyHint}
              icon={<CircleHelp className="h-6 w-6" aria-hidden="true" />}
            />
          ) : null}
          {!readError && page && page.threads.length > 0 ? (
            <ul className="min-w-0 space-y-3 overflow-x-clip">
              {page.threads.map((thread) => (
                <li
                  key={thread.id}
                  className="min-w-0 overflow-x-clip rounded-lg border border-base bg-surface p-3"
                >
                  <div className="mb-1 flex flex-wrap gap-2 text-[11px] uppercase text-muted">
                    <span>{thread.status === "resolved" ? copy.resolved : copy.open}</span>
                    <span>{thread.answerCount}</span>
                    {thread.buildContext ? (
                      <span>
                        {copy.buildContext}: {thread.buildContext.version}
                        {!thread.buildContext.available ? ` · ${copy.buildUnavailable}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="break-words text-sm text-secondary">{thread.body}</p>
                  <button
                    type="button"
                    className={`mt-2 ${textActionClass}`}
                    onClick={() => void loadThread(thread.id)}
                  >
                    {copy.loadThread}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
