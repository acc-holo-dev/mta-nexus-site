import { CHANGE_HISTORY_PERIODS, type CommunityReportGroupFilters } from "@nexus/domain";
import Link from "next/link";
import { REPORT_TYPES } from "../lib/community-report-contract";
import { communityReportCopy } from "../lib/community-report-copy";
import { type ReportGroupsPage, reportGroupsHref } from "../lib/community-report-groups-contract";
import { reportGroupsCopy } from "../lib/community-report-groups-copy";
import type { Locale } from "../lib/i18n";
import { privateChangeHistoryCopy } from "../lib/private-change-history-copy";
import { platformFieldClass } from "../lib/user-platform-client";
import { PrivateChangeHistoryCutoff } from "./private-change-history-controls";
export function CommunityReportGroups({
  page,
  filters,
  locale,
}: {
  page: ReportGroupsPage;
  filters: CommunityReportGroupFilters;
  locale: Locale;
}) {
  const copy = reportGroupsCopy(locale),
    labels = communityReportCopy(locale),
    path = "/admin/reports/targets";
  const date = (time: string) =>
    new Date(time).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { timeZone: "UTC" });
  const contextQuery = new URLSearchParams({ view: filters.view });
  if (filters.type) contextQuery.set("type", filters.type);
  if (filters.query) contextQuery.set("q", filters.query);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/admin/reports"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">{copy.order}</p>
      </header>
      <form method="get" action={path} className="nexus-panel grid gap-3 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-secondary">
          <span>{copy.search}</span>
          <input
            name="q"
            type="search"
            maxLength={80}
            defaultValue={filters.query}
            className={platformFieldClass}
          />
        </label>
        <label className="space-y-1 text-sm text-secondary">
          <span>{copy.period}</span>
          <select name="period" defaultValue={filters.period} className={platformFieldClass}>
            {CHANGE_HISTORY_PERIODS.map((period) => (
              <option key={period} value={period}>
                {privateChangeHistoryCopy(locale).periods[period]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          <span>{copy.view}</span>
          <select name="view" defaultValue={filters.view} className={platformFieldClass}>
            <option value="pending">{copy.pending}</option>
            <option value="history">{copy.history}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          <span>{copy.target}</span>
          <select name="target" defaultValue={filters.target ?? ""} className={platformFieldClass}>
            <option value="">{copy.all}</option>
            <option value="content">{labels.content}</option>
            <option value="comment">{labels.comment}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          <span>{copy.type}</span>
          <select name="type" defaultValue={filters.type ?? ""} className={platformFieldClass}>
            <option value="">{copy.all}</option>
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {labels[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-4">
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-base bg-surface px-4 py-2 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-accent"
          >
            {copy.apply}
          </button>
          <Link
            href={path}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.reset}
          </Link>
        </div>
      </form>
      <PrivateChangeHistoryCutoff until={page.until} locale={locale} />
      {page.items.length === 0 ? (
        <p role="status" className="nexus-panel p-5 text-muted">
          {copy.empty}
        </p>
      ) : (
        <ol className="space-y-3">
          {page.items.map((item) => (
            <li key={`${item.targetType}:${item.targetId}`} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words text-base font-semibold text-primary">
                {labels[item.targetType]} · {item.target?.title ?? item.targetId}
              </h2>
              {item.target?.text && (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {item.target.text}
                </p>
              )}
              {!item.target && <p className="text-xs text-muted">{copy.unknown}</p>}
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {(["open", "review", "resolved", "dismissed"] as const).map((key) => (
                  <div key={key}>
                    <dt className="text-muted">
                      {labels[key === "review" ? "under_review" : key]}
                    </dt>
                    <dd className="font-numeric text-primary">
                      {item[key].toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">
                {copy.first}: <time dateTime={item.firstAt}>{date(item.firstAt)} UTC</time> ·{" "}
                {copy.last}: <time dateTime={item.lastAt}>{date(item.lastAt)} UTC</time>
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={item.reportHref}
                  className="inline-flex min-h-11 items-center text-sm text-accent underline"
                >
                  {labels.detail}
                </Link>
                {item.target && (
                  <>
                    <Link
                      href={`${item.targetType === "content" ? `/admin/community/${item.target.contentId}/reports` : `/admin/community/${item.target.contentId}/discussion/${item.targetId}/reports`}?${contextQuery}`}
                      className="inline-flex min-h-11 items-center text-sm text-accent underline"
                    >
                      {copy.inspect}
                    </Link>
                    <Link
                      href={
                        item.targetType === "content"
                          ? `/admin/community/${item.target.contentId}`
                          : `/admin/community/${item.target.contentId}/discussion/${item.targetId}`
                      }
                      className="inline-flex min-h-11 items-center text-sm text-accent underline"
                    >
                      {copy.context}
                    </Link>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <nav aria-label={copy.title} className="flex flex-wrap gap-4">
        <Link
          href={reportGroupsHref(filters, path, { fresh: true })}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.latest}
        </Link>
        {page.nextCursor && (
          <Link
            href={reportGroupsHref(filters, path, { cursor: page.nextCursor, until: page.until })}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.more}
          </Link>
        )}
      </nav>
    </div>
  );
}
