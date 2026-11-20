"use client";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { linkFocusRing, linkGhostAccentSm, linkMuted } from "../../shell/link-shell";
import { pageShellStack5 } from "../../shell/page-shell";
import { panelFlexMinWrapEndP4, panelMinSpace2P4 } from "../../shell/panel-shell";
import {
  typeFlexMinWrapGap3,
  typeFlexWrapCenterGap4Sm,
  typeMinSpace3,
  typeMinW40Flex1Space1SmSecondary,
  typePrewrapSmSecondary,
  typeXsMuted,
  typeXsSecondary,
} from "../../shell/type-shell";
import {
  type CommunityReportPage,
  type CommunityReportQuery,
  communityReportPageSchema,
  REPORT_TYPES,
} from "../community-report-contract";
import { communityReportCopy, communityReportError } from "../community-report-copy";
import { platformFieldClass, platformRequest } from "../user-platform-client";
import { getUserPlatformCopy } from "../user-platform-copy";
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
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
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
      setError(safeMessage(caught, copy.unavailable));
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <div className={pageShellStack5} aria-busy={pending}>
      <nav className={typeFlexMinWrapGap3} aria-label={copy.status}>
        {(["pending", "history"] as const).map((view) => (
          <Link
            key={view}
            href={href({ view, page: 1 })}
            aria-current={filters.view === view ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm ${linkFocusRing} ${filters.view === view ? "bg-accent-soft text-accent" : "text-secondary"}`}
          >
            {copy[view]}
          </Link>
        ))}
      </nav>
      <search aria-label={copy.textSearch}>
        <form method="GET" action={path} className={panelFlexMinWrapEndP4}>
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
          <label className={typeMinW40Flex1Space1SmSecondary}>
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
          <label className={typeMinW40Flex1Space1SmSecondary}>
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
            className={`inline-flex min-h-11 items-center text-sm text-accent underline ${linkFocusRing}`}
            href={path}
          >
            {copy.reset}
          </Link>
        </form>
      </search>
      {error ? (
        <ErrorState
          title={error}
          description={copy.unavailableHint}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void reload()}
              className={linkGhostAccentSm}
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
                className={`inline-flex min-h-11 items-center text-accent underline ${linkFocusRing}`}
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      <div className={typeMinSpace3}>
        {!error
          ? page?.items.map((report) => (
              <article key={report.id} className={panelMinSpace2P4}>
                <div className="flex min-w-0 flex-wrap justify-between gap-2">
                  <Link
                    className={`break-words text-sm font-semibold text-accent underline ${linkFocusRing}`}
                    href={`${path}/${encodeURIComponent(report.id)}`}
                  >
                    {copy[report.targetType]} · {copy[report.type]}
                  </Link>
                  <span className={typeXsSecondary}>{copy[report.status]}</span>
                </div>
                <p className={typePrewrapSmSecondary}>{report.reason}</p>
                <p className={typeXsMuted}>
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
        <nav className={typeFlexWrapCenterGap4Sm} aria-label={copy.page}>
          {filters.page > 1 && (
            <Link
              className={`inline-flex min-h-11 items-center text-accent underline ${linkFocusRing}`}
              href={href({ page: filters.page - 1 })}
            >
              {copy.previous}
            </Link>
          )}
          <span className={linkMuted}>
            {copy.page} {filters.page}
          </span>
          {page?.hasMore && filters.page < 9999 && (
            <Link
              className={`inline-flex min-h-11 items-center text-accent underline ${linkFocusRing}`}
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
