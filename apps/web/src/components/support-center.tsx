"use client";

import { LifeBuoy, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supportHref, type SupportQuery } from "../lib/support-workspace-contract";
import {
  SupportClientFailure,
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../lib/support-workspace-copy";
import { useNexusLocale } from "./locale-context";
import {
  clearSupportRetry,
  reserveSupportCaseRetry,
  resolveSupportRetryActorScope,
} from "../lib/support-retry";
import {
  confirmSupportCaseCreated,
  parseSupportCasePage,
  type SupportCaseSummary,
  type SupportCaseStatus,
} from "../lib/support-response";

export function SupportCenter({
  staffMode = false,
  initialFilters = { page: 1, q: "" },
}: {
  staffMode?: boolean;
  initialFilters?: SupportQuery;
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
  const [category, setCategory] = useState("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [staffStatus, setStaffStatus] = useState<SupportCaseStatus | "">(
    initialFilters.status ?? "",
  );
  const [staffCategory, setStaffCategory] = useState(initialFilters.category ?? "");
  const loadSequence = useRef(0);

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
    const payload = JSON.stringify({
      category,
      subject: subject.trim(),
      message: message.trim(),
    });
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
      setSubject("");
      setMessage("");
      setCreatedCaseId(created.id);
      if (!(await loadCases())) setError(workspaceCopy.savedRefresh);
    } catch (caught) {
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

      {authRequired ? (
        <div className="nexus-panel space-y-3 p-5">
          <p className="text-sm text-secondary">{copy.authRequired}</p>
          <Link
            href="/auth/login"
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.signIn}
          </Link>
        </div>
      ) : (
        <>
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
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-label text-secondary">{copy.subject}</span>
                <input
                  value={subject}
                  disabled={creating}
                  onChange={(event) => setSubject(event.target.value)}
                  minLength={5}
                  maxLength={120}
                  required
                  className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  placeholder={copy.subjectPlaceholder}
                />
              </label>

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

              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {creating ? copy.creating : copy.create}
              </button>
            </form>
          )}

          {createdCaseId && !staffMode && (
            <div role="status">
              <Link
                href={`${basePath}/${encodeURIComponent(createdCaseId)}`}
                className="block text-sm font-semibold text-accent underline"
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
                <button
                  type="submit"
                  className="min-h-10 rounded-lg border border-base px-4 text-sm font-semibold text-accent"
                >
                  {workspaceCopy.apply}
                </button>
                <Link href={basePath} className="min-h-10 py-2 text-sm text-accent underline">
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
              <p className="text-sm text-muted">{copy.loading}</p>
            ) : error ? (
              <button
                type="button"
                onClick={() => void loadCases()}
                className="min-h-10 text-sm text-accent underline"
              >
                {workspaceCopy.reload}
              </button>
            ) : cases.length === 0 ? (
              <div className="nexus-panel p-5 text-sm text-muted">
                {initialFilters.q || initialFilters.category || initialFilters.status
                  ? workspaceCopy.noMatches
                  : copy.empty}
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
                  className="min-h-9 text-sm text-accent underline"
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
                  className="min-h-9 text-sm text-accent underline"
                >
                  {dictionary.market.nextPage}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
