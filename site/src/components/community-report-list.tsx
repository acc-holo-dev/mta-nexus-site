"use client";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  type CommunityReportPage,
  type CommunityReportQuery,
  communityReportPageSchema,
  REPORT_TYPES,
} from "../lib/community-report-contract";
import { communityReportCopy, communityReportError } from "../lib/community-report-copy";
import type { Locale } from "../lib/i18n";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";

const filterNavLinkClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function CommunityReportList({
  initial,
  filters,
  locale,
  staff = false,
}: {
  initial: CommunityReportPage | null;
  filters: CommunityReportQuery;
  locale: Locale;
  staff?: boolean;
}) {
  const copy = communityReportCopy(locale),
    path = staff ? "/admin/reports" : "/workspace/reports";
  const [page, setPage] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState(initial ? "" : copy.unavailable);
  const guard = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const filtersActive = Boolean(filters.target || filters.type || filters.query);
  useEffect(() => () => controller.current?.abort(), []);
  function href(changes: Partial<CommunityReportQuery> = {}) {
    const values = { ...filters, ...changes },
      params = new URLSearchParams({ view: values.view, page: String(values.page) });
    if (values.target) params.set("target", values.target);
    if (values.type) params.set("type", values.type);
    if (values.query) params.set("q", values.query);
    return `${path}?${params}`;
  }
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const result = communityReportPageSchema.safeParse(
        await platformRequest(
          `/api${href()}`,
          locale,
          "GET",
          undefined,
          controller.current.signal,
          communityReportError,
        ),
      );
      if (!result.success || result.data.page !== filters.page || result.data.view !== filters.view)
        throw new Error(copy.unavailable);
      setPage(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <div className="min-w-0 space-y-5 overflow-x-clip" aria-busy={pending}>
      <nav className="flex min-w-0 flex-wrap gap-3" aria-label={copy.status}>
        {(["pending", "history"] as const).map((view) => (
          <Link
            key={view}
            href={href({ view, page: 1 })}
            aria-current={filters.view === view ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm ${filterNavLinkClass} ${filters.view === view ? "bg-accent-soft text-accent" : "text-secondary"}`}
          >
            {copy[view]}
          </Link>
        ))}
      </nav>
      <search aria-label={copy.textSearch}>
        <form
          method="GET"
          action={path}
          className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
        >
          <input type="hidden" name="view" value={filters.view} />
          <label className="min-w-0 basis-full space-y-1 text-sm text-secondary">
            <span>{copy.textSearch}</span>
            <input
              name="q"
              type="search"
              maxLength={80}
              defaultValue={filters.query ?? ""}
              className={platformFieldClass}
              aria-describedby="community-report-search-help"
            />
            <span id="community-report-search-help" className="block text-xs text-muted">
              {copy.searchHint}
            </span>
          </label>
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.target}</span>
            <select
              name="target"
              defaultValue={filters.target ?? ""}
              className={platformFieldClass}
            >
              <option value="">{copy.all}</option>
              <option value="content">{copy.content}</option>
              <option value="comment">{copy.comment}</option>
            </select>
          </label>
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.category}</span>
            <select name="type" defaultValue={filters.type ?? ""} className={platformFieldClass}>
              <option value="">{copy.all}</option>
              {REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11">
            {copy.search}
          </Button>
          <Link
            className={`inline-flex min-h-11 items-center text-sm text-accent underline ${filterNavLinkClass}`}
            href={path}
          >
            {copy.reset}
          </Link>
        </form>
      </search>
      {error ? (
        <ErrorState
          title={error}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void reload()}
              className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {pending ? copy.loading : copy.reload}
            </Button>
          }
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => void reload()}
          className="min-h-11"
        >
          {pending ? copy.loading : copy.reload}
        </Button>
      )}
      {!error && page?.items.length === 0 ? (
        <EmptyState
          title={filtersActive ? copy.emptyFiltered : copy.empty}
          description={filtersActive ? copy.reset : copy.description}
          icon={<Flag className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link
                href={path}
                className={`inline-flex min-h-11 items-center text-accent underline ${filterNavLinkClass}`}
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      <div className="min-w-0 space-y-3">
        {!error
          ? page?.items.map((report) => (
              <article key={report.id} className="nexus-panel min-w-0 space-y-2 p-4">
                <div className="flex min-w-0 flex-wrap justify-between gap-2">
                  <Link
                    className={`break-words text-sm font-semibold text-accent underline ${filterNavLinkClass}`}
                    href={`${path}/${encodeURIComponent(report.id)}`}
                  >
                    {copy[report.targetType]} · {copy[report.type]}
                  </Link>
                  <span className="text-xs text-secondary">{copy[report.status]}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {report.reason}
                </p>
                <p className="text-xs text-muted">
                  {copy.created}:{" "}
                  <time dateTime={report.createdAt}>
                    {new Date(report.createdAt).toLocaleString(
                      locale === "ru" ? "ru-RU" : "en-US",
                      {
                        timeZone: "UTC",
                      },
                    )}{" "}
                    UTC
                  </time>
                </p>
              </article>
            ))
          : null}
      </div>
      {!error ? (
        <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label={copy.page}>
          {filters.page > 1 && (
            <Link
              className={`inline-flex min-h-11 items-center text-accent underline ${filterNavLinkClass}`}
              href={href({ page: filters.page - 1 })}
            >
              {copy.previous}
            </Link>
          )}
          <span className="inline-flex min-h-11 items-center text-muted">
            {copy.page} {filters.page}
          </span>
          {page?.hasMore && filters.page < 9999 && (
            <Link
              className={`inline-flex min-h-11 items-center text-accent underline ${filterNavLinkClass}`}
              href={href({ page: filters.page + 1 })}
            >
              {copy.next}
            </Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}
