import {
  CHANGE_HISTORY_PERIODS,
  type ChangeHistoryFilters,
  REPORT_HISTORY_GROUPS,
  type ReportHistoryGroup,
} from "@nexus/domain";
import { Button, EmptyState } from "@nexus/ui";
import { Clock3 } from "lucide-react";
import Link from "next/link";
import { communityReportCopy } from "../lib/community-report-copy";
import type { ReportHistoryPage } from "../lib/community-report-history-contract";
import { reportHistoryCopy } from "../lib/community-report-history-copy";
import type { Locale } from "../lib/i18n";
import { privateChangeHistoryCopy } from "../lib/private-change-history-copy";
import { changeHistoryHref } from "../lib/private-change-history-query";
import { platformFieldClass } from "../lib/user-platform-client";
import { PrivateChangeHistoryCutoff } from "./private-change-history-controls";
export function CommunityReportHistory({
  page,
  filters,
  locale,
}: {
  page: ReportHistoryPage;
  filters: ChangeHistoryFilters<ReportHistoryGroup>;
  locale: Locale;
}) {
  const copy = reportHistoryCopy(locale),
    reportCopy = communityReportCopy(locale),
    base = `${page.audience === "staff" ? "/admin/reports" : "/workspace/reports"}/${encodeURIComponent(page.report.id)}`,
    path = `${base}/history`,
    filtered =
      filters.period !== "all" ||
      filters.group !== "all" ||
      !!filters.query?.trim() ||
      !!filters.cursor ||
      !!filters.until;
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-5 overflow-x-clip">
      <Link
        href={base}
        className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      <header className="min-w-0 space-y-2">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="text-sm text-secondary">
          {reportCopy[page.report.targetType]} · {reportCopy[page.report.type]} ·{" "}
          {reportCopy[page.report.status]}
        </p>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">
          {page.audience === "staff" ? copy.staffHint : copy.ownHint}
        </p>
      </header>
      <form
        method="get"
        action={path}
        className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
      >
        <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
          <span>{copy.period}</span>
          <select name="period" defaultValue={filters.period} className={platformFieldClass}>
            {CHANGE_HISTORY_PERIODS.map((period) => (
              <option key={period} value={period}>
                {privateChangeHistoryCopy(locale).periods[period]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
          <span>{copy.group}</span>
          <select name="group" defaultValue={filters.group} className={platformFieldClass}>
            {REPORT_HISTORY_GROUPS.map((group) => (
              <option key={group} value={group}>
                {copy.groups[group]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11" variant="outline">
          {copy.apply}
        </Button>
        <Link
          href={path}
          className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.reset}
        </Link>
      </form>
      <div className="flex min-w-0 flex-wrap justify-between gap-3 text-sm">
        <Link
          href={changeHistoryHref(path, filters, { fresh: true })}
          className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.latest}
        </Link>
        <a
          href={changeHistoryHref(`/api${base}/history/export`, filters, { until: page.until })}
          className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.download}
        </a>
      </div>
      <p className="text-xs text-muted">{copy.exportHint}</p>
      <PrivateChangeHistoryCutoff until={page.until} locale={locale} />
      {page.items.length === 0 ? (
        <EmptyState
          title={filtered ? copy.emptyFiltered : copy.empty}
          description={filtered ? copy.reset : copy.description}
          icon={<Clock3 className="h-6 w-6" aria-hidden="true" />}
          action={
            filtered ? (
              <Link
                href={path}
                className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ol className="min-w-0 space-y-3" aria-label={copy.title}>
          {page.items.map((event) => (
            <li key={event.id} className="nexus-panel min-w-0 space-y-2 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">{copy.actions[event.action]}</h2>
                <time dateTime={event.createdAt} className="text-xs text-muted">
                  {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>
              <p className="text-xs text-secondary">{copy.by[event.by]}</p>
              <p className="text-sm text-secondary">
                {event.from && `${reportCopy[event.from]} → `}
                {event.to ? reportCopy[event.to] : copy.unknown}
              </p>
              {event.removed && <p className="text-xs text-muted">{copy.removed}</p>}
              {page.audience === "staff" && "notes" in event && event.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-primary">{copy.notes}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {event.notes}
                  </p>
                </div>
              )}
              {page.audience === "staff" && "batchSize" in event && event.batchSize !== null && (
                <p className="text-xs text-muted">
                  {copy.batch}: {event.batchSize}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {page.nextCursor && (
        <Link
          href={changeHistoryHref(path, filters, { cursor: page.nextCursor, until: page.until })}
          className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.older}
        </Link>
      )}
    </div>
  );
}
