"use client";
import { Button, Input } from "@nexus/ui";

import { LifeBuoy, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  confirmSupportCaseCreated,
  parseSupportCasePage,
  type SupportCaseStatus,
  type SupportCaseSummary,
} from "../lib/support-response";
import {
  clearSupportRetry,
  reserveSupportCaseRetry,
  resolveSupportRetryActorScope,
} from "../lib/support-retry";
import { type SupportQuery, supportHref } from "../lib/support-workspace-contract";
import {
  SupportClientFailure,
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../lib/support-workspace-copy";
import { currentBrowserReturnPath } from "./auth-return-path";
import { PlatformSignIn } from "./platform-sign-in";
import { useNexusLocale } from "./locale-context";

const SUPPORT_OBJECT_CONTEXT_KEY = "nexus.support.objectContext";

export type SupportFormObjectContext = {
  productId: string;
  buildId?: string;
  receiptId?: string;
};

function isSupportFormObjectContext(value: unknown): value is SupportFormObjectContext {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.productId !== "string" || !/^prd_[a-f0-9]{24}$/u.test(record.productId))
    return false;
  if (
    record.buildId !== undefined &&
    (typeof record.buildId !== "string" || !/^bld_[a-f0-9]{24}$/u.test(record.buildId))
  )
    return false;
  if (
    record.receiptId !== undefined &&
    (typeof record.receiptId !== "string" || !/^dlv_[a-f0-9]{24}$/u.test(record.receiptId))
  )
    return false;
  return true;
}

/** Stash verified-looking object ids for /support?category=resource (query stays filter-safe). */
export function stashSupportObjectContext(context: SupportFormObjectContext) {
  try {
    sessionStorage.setItem(SUPPORT_OBJECT_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    /* private mode */
  }
}

function readSupportObjectContext(): SupportFormObjectContext | null {
  try {
    const raw = sessionStorage.getItem(SUPPORT_OBJECT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSupportFormObjectContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clearSupportObjectContext() {
  try {
    sessionStorage.removeItem(SUPPORT_OBJECT_CONTEXT_KEY);
  } catch {
    /* private mode */
  }
}

export function supportObjectContextHref(context?: SupportFormObjectContext | null) {
  if (context) stashSupportObjectContext(context);
  return "/support?category=resource";
}

export function SupportCenter({
  staffMode = false,
  initialFilters = { page: 1, q: "" },
  initialContext = null,
}: {
  staffMode?: boolean;
  initialFilters?: SupportQuery;
  initialContext?: SupportFormObjectContext | null;
}) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.support,
    workspaceCopy = supportWorkspaceCopy(locale);
  const [cases, setCases] = useState<SupportCaseSummary[]>([]);
  const [page, setPage] = useState(initialFilters.page);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  // Keep a retry key after an ambiguous timeout; change it for a new payload.
  const pendingCreate = useRef<{ payload: string; key: string } | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(initialFilters.category ?? "account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [objectContext, setObjectContext] = useState<SupportFormObjectContext | null>(
    initialContext,
  );
  const [staffStatus, setStaffStatus] = useState<SupportCaseStatus | "">(
    initialFilters.status ?? "",
  );
  const [staffCategory, setStaffCategory] = useState(initialFilters.category ?? "");
  const loadSequence = useRef(0);

  useEffect(() => {
    if (initialContext) {
      setObjectContext(initialContext);
      stashSupportObjectContext(initialContext);
      return;
    }
    const stored = readSupportObjectContext();
    if (stored) {
      setObjectContext(stored);
      if (!initialFilters.category) setCategory("resource");
    }
  }, [initialContext, initialFilters.category]);

  const categories = [
    ["account", copy.categoryAccount],
    ["resource", copy.categoryResource],
    ["server", copy.categoryServer],
    ["purchase", copy.categoryPurchase],
    ["license", copy.categoryLicense],
    ["payment", copy.categoryPayment],
    ["seller", copy.categorySeller],
    ["integration", copy.categoryIntegration],
    ["other", copy.categoryOther],
  ] as const;

  const categoryLabel = (value: string) =>
    categories.find(([candidate]) => candidate === value)?.[1] ?? value;

  const loadCases = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++loadSequence.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (staffMode) params.set("scope", "staff");
        if (initialFilters.status) params.set("status", initialFilters.status);
        if (initialFilters.category) params.set("category", initialFilters.category);
        if (initialFilters.q) params.set("q", initialFilters.q);
        const response = await fetch(`/api/support?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
            : AbortSignal.timeout(15_000),
        });
        if (sequence !== loadSequence.current || signal?.aborted) return false;
        if (response.status === 401) {
          setAuthRequired(true);
          setCases([]);
          return false;
        }
        const data = await response.json().catch(() => null);
        if (sequence !== loadSequence.current || signal?.aborted) return false;
        const validated = parseSupportCasePage(data);
        if (!response.ok || !validated) throw new Error(copy.loadError);
        setAuthRequired(false);
        setCases(validated.cases);
        setPage(validated.page);
        setTotalPages(validated.totalPages);
        return true;
      } catch {
        if (sequence !== loadSequence.current || signal?.aborted) return false;
        setCases([]);
        setError(copy.loadError);
        return false;
      } finally {
        if (sequence === loadSequence.current && !signal?.aborted) setLoading(false);
      }
    },
    [
      copy.loadError,
      page,
      staffMode,
      initialFilters.status,
      initialFilters.category,
      initialFilters.q,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadCases(controller.signal);
    return () => {
      controller.abort();
      loadSequence.current += 1;
    };
  }, [loadCases]);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;

    setCreating(true);
    setError(null);
    setCreatedCaseId(null);
    const payloadBody: Record<string, unknown> = {
      category,
      subject: subject.trim(),
      message: message.trim(),
    };
    if (objectContext) payloadBody.context = objectContext;
    const payload = JSON.stringify(payloadBody);
    try {
      const actorScope = await resolveSupportRetryActorScope();
      const attempt = await reserveSupportCaseRetry(payload, { actorScope });
      const requestKey = attempt.key;
      pendingCreate.current = { payload, key: requestKey };
      const response = await fetch("/api/support", {
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
      const created = confirmSupportCaseCreated(response.status, data, { category, subject });
      if (!response.ok || !created) {
        throw new SupportClientFailure(
          response.status >= 400 && response.status < 500
            ? supportWorkspaceError(locale, data?.code ?? response.status)
            : workspaceCopy.uncertain,
        );
      }

      clearSupportRetry("case", requestKey, { actorScope });
      pendingCreate.current = null;
      clearSupportObjectContext();
      setObjectContext(null);
      setSubject("");
      setMessage("");
      setCreatedCaseId(created.id);
      if (!(await loadCases())) setError(workspaceCopy.savedRefresh);
    } catch (caught) {
      // Keep subject/message/context so a lost response can retry with the same intent.
      setError(caught instanceof SupportClientFailure ? caught.message : workspaceCopy.uncertain);
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const basePath = staffMode ? "/admin/support" : "/support";
  const statusLabel = (status: SupportCaseSummary["status"]) =>
    status === "open" ? copy.open : status === "resolved" ? copy.resolved : copy.closed;

  if (authRequired) {
    // Prefer the live browser path; omit when unknown so PlatformSignIn uses usePathname.
    return <PlatformSignIn locale={locale} returnPath={currentBrowserReturnPath() || undefined} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2 border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 font-display text-primary">
          <LifeBuoy className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>{staffMode ? copy.staffQueue : copy.title}</span>
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          {staffMode ? copy.staffDescription : copy.description}
        </p>
        {!staffMode && <p className="text-xs text-warning">{copy.noGuaranteedSla}</p>}
      </header>

      {!staffMode && (
        <form
          onSubmit={(event) => void createCase(event)}
          aria-busy={creating}
          className="nexus-panel space-y-4 p-5"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="font-heading text-primary">{copy.newCase}</h2>
          </div>

          <label className="block space-y-1.5">
            <span className="font-label text-secondary">{copy.category}</span>
            <select
              value={category}
              disabled={creating}
              onChange={(event) => {
                const next = event.target.value;
                if (categories.some(([value]) => value === next)) {
                  setCategory(next as (typeof categories)[number][0]);
                }
              }}
              className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {objectContext ? (
            <div
              role="note"
              className="rounded-lg border border-base bg-inset p-3 text-sm text-secondary"
            >
              <p className="font-label uppercase text-muted">
                {locale === "ru" ? "Контекст обращения" : "Attached context"}
              </p>
              <p className="mt-1 break-all">
                {locale === "ru" ? "Ресурс" : "Resource"}: {objectContext.productId}
              </p>
              {objectContext.buildId ? (
                <p className="break-all">
                  {locale === "ru" ? "Сборка" : "Build"}: {objectContext.buildId}
                </p>
              ) : null}
              {objectContext.receiptId ? (
                <p className="break-all">
                  {locale === "ru" ? "Квитанция скачивания" : "Download receipt"}:{" "}
                  {objectContext.receiptId}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={creating}
                className="mt-2 h-auto min-h-9 px-0 text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                onClick={() => {
                  clearSupportObjectContext();
                  setObjectContext(null);
                }}
              >
                {locale === "ru" ? "Убрать контекст" : "Remove context"}
              </Button>
            </div>
          ) : null}

          <Input
            label={copy.subject}
            value={subject}
            disabled={creating}
            onChange={(event) => setSubject(event.target.value)}
            minLength={5}
            maxLength={120}
            required
            placeholder={copy.subjectPlaceholder}
          />

          <label className="block space-y-1.5">
            <span className="font-label text-secondary">{copy.message}</span>
            <textarea
              value={message}
              disabled={creating}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={4000}
              required
              rows={5}
              className="w-full resize-y rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              placeholder={copy.messagePlaceholder}
            />
          </label>

          <Button type="submit" disabled={creating} isLoading={creating} variant="primary">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            {creating ? copy.creating : copy.create}
          </Button>
        </form>
      )}

      {createdCaseId && !staffMode && (
        <div role="status">
          <Link
            href={`${basePath}/${encodeURIComponent(createdCaseId)}`}
            className="block text-sm font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {workspaceCopy.created}: {createdCaseId}
          </Link>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <form action={basePath} method="get">
        <fieldset
          className="nexus-panel grid gap-4 p-4 sm:grid-cols-2"
          aria-label={copy.staffFilters}
        >
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="font-label text-secondary">{workspaceCopy.search}</span>
            <input
              type="search"
              name="q"
              maxLength={120}
              defaultValue={initialFilters.q}
              className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="font-label text-secondary">{copy.filterStatus}</span>
            <select
              name="status"
              value={staffStatus}
              onChange={(event) => {
                setStaffStatus(event.target.value as SupportCaseStatus | "");
              }}
              className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary"
            >
              <option value="">{copy.allStatuses}</option>
              <option value="open">{copy.open}</option>
              <option value="resolved">{copy.resolved}</option>
              <option value="closed">{copy.closed}</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="font-label text-secondary">{copy.category}</span>
            <select
              name="category"
              value={staffCategory}
              onChange={(event) => {
                setStaffCategory(event.target.value);
              }}
              className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary"
            >
              <option value="">{copy.allCategories}</option>
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            <Button type="submit" className="min-h-10" variant="outline">
              {workspaceCopy.apply}
            </Button>
            <Link
              href={basePath}
              className="min-h-10 py-2 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {workspaceCopy.reset}
            </Link>
          </div>
        </fieldset>
      </form>

      <section className="space-y-3" aria-busy={loading}>
        <h2 className="font-heading text-primary">
          {staffMode ? copy.staffQueue : copy.yourCases}
        </h2>

        {loading ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <p className="text-sm text-muted">{copy.loading}</p>
            <div className="animate-pulse space-y-3" aria-hidden="true">
              {[1, 2, 3].map((key) => (
                <div key={key} className="nexus-panel h-24 p-4">
                  <div className="mb-3 h-4 max-w-md rounded bg-inset" />
                  <div className="h-3 w-32 rounded bg-inset" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <Button
            type="button"
            onClick={() => void loadCases()}
            className="h-auto min-h-10 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            variant="ghost"
          >
            {workspaceCopy.reload}
          </Button>
        ) : cases.length === 0 ? (
          <div className="nexus-panel space-y-3 p-5 text-sm text-muted">
            <p>
              {initialFilters.q || initialFilters.category || initialFilters.status
                ? workspaceCopy.noMatches
                : copy.empty}
            </p>
            {(initialFilters.q || initialFilters.category || initialFilters.status) && (
              <Link
                href={basePath}
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {workspaceCopy.reset}
              </Link>
            )}
          </div>
        ) : (
          cases.map((supportCase) => (
            <Link
              key={supportCase.id}
              href={`${basePath}/${encodeURIComponent(supportCase.id)}`}
              className="nexus-panel block space-y-2 p-4 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-bold text-primary">
                    {supportCase.subject}
                  </h3>
                  {staffMode && supportCase.requesterUsername && (
                    <p className="mt-1 text-xs text-muted">
                      {copy.requester}: @{supportCase.requesterUsername}
                    </p>
                  )}
                </div>
                <span className="rounded-full border border-base bg-inset px-2.5 py-1 font-label text-muted">
                  {statusLabel(supportCase.status)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-faint">
                <span>{categoryLabel(supportCase.category)}</span>
                <time dateTime={new Date(supportCase.updatedAt).toISOString()}>
                  {copy.updated}: {new Date(supportCase.updatedAt).toLocaleString(dateLocale)}
                </time>
              </div>
            </Link>
          ))
        )}
      </section>

      {totalPages > 1 && (
        <nav
          aria-label={dictionary.market.paginationLabel}
          className="flex items-center justify-between gap-3"
        >
          {page > 1 ? (
            <Link
              href={supportHref(basePath, initialFilters, page - 1)}
              className="min-h-9 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.market.previousPage}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-secondary">
            {dictionary.market.pageLabel} {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={supportHref(basePath, initialFilters, page + 1)}
              className="min-h-9 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.market.nextPage}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
