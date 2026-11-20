import {
  CHANGE_HISTORY_PERIODS,
  type ChangeHistoryFilters,
  REPORT_HISTORY_GROUPS,
  type ReportHistoryGroup,
} from "@nexus/domain";
import { Button, EmptyState } from "@nexus/ui";
import { Clock3 } from "lucide-react";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { PrivateChangeHistoryCutoff } from "../../accounts/change-history";
import { privateChangeHistoryCopy } from "../../accounts/private-change-history-copy";
import { changeHistoryHref } from "../../accounts/private-change-history-query";
import { linkAccent, linkAccentRounded, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xlCompactTight } from "../../shell/page-shell";
import { panelFlexMinWrapEndP4, panelMinSpace2P4 } from "../../shell/panel-shell";
import {
  typeDisplayPrimary,
  typeFlexWrapBetweenGap2,
  typeMinW40Flex1Space1SmSecondary,
  typePrewrapSmSecondary,
  typeSmSecondary,
  typeSmSemiboldPrimary,
  typeXsSecondary,
} from "../../shell/type-shell";
import { communityReportCopy } from "../community-report-copy";
import type { ReportHistoryPage } from "../community-report-history-contract";
import { reportHistoryCopy } from "../community-report-history-copy";
import { platformFieldClass } from "../user-platform-client";
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
    <div className={pageShellMax4xlCompactTight}>
      <Link href={base} className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <header className="min-w-0 space-y-2">
        <h1 className={typeDisplayPrimary}>{copy.title}</h1>
        <p className={typeSmSecondary}>
          {reportCopy[page.report.targetType]} · {reportCopy[page.report.type]} ·{" "}
          {reportCopy[page.report.status]}
        </p>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">
          {page.audience === "staff" ? copy.staffHint : copy.ownHint}
        </p>
      </header>
      <form method="get" action={path} className={panelFlexMinWrapEndP4}>
        <label className={typeMinW40Flex1Space1SmSecondary}>
          <span>{copy.period}</span>
          <select name="period" defaultValue={filters.period} className={platformFieldClass}>
            {CHANGE_HISTORY_PERIODS.map((period) => (
              <option key={period} value={period}>
                {privateChangeHistoryCopy(locale).periods[period]}
              </option>
            ))}
          </select>
        </label>
        <label className={typeMinW40Flex1Space1SmSecondary}>
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
        <Link href={path} className={linkAccentSmRounded}>
          {copy.reset}
        </Link>
      </form>
      <div className="flex min-w-0 flex-wrap justify-between gap-3 text-sm">
        <Link
          href={changeHistoryHref(path, filters, { fresh: true })}
          className={linkAccentRounded}
        >
          {copy.latest}
        </Link>
        <a
          href={changeHistoryHref(`/api${base}/history/export`, filters, { until: page.until })}
          className={linkAccentRounded}
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
              <Link href={path} className={linkAccent}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ol className="min-w-0 space-y-3" aria-label={copy.title}>
          {page.items.map((event) => (
            <li key={event.id} className={panelMinSpace2P4}>
              <div className={typeFlexWrapBetweenGap2}>
                <h2 className={typeSmSemiboldPrimary}>{copy.actions[event.action]}</h2>
                <time dateTime={event.createdAt} className="text-xs text-muted">
                  {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>
              <p className={typeXsSecondary}>{copy.by[event.by]}</p>
              <p className={typeSmSecondary}>
                {event.from && `${reportCopy[event.from]} → `}
                {event.to ? reportCopy[event.to] : copy.unknown}
              </p>
              {event.removed && <p className="text-xs text-muted">{copy.removed}</p>}
              {page.audience === "staff" && "notes" in event && event.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-primary">{copy.notes}</h3>
                  <p className={typePrewrapSmSecondary}>{event.notes}</p>
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
          className={linkAccentSmRounded}
        >
          {copy.older}
        </Link>
      )}
    </div>
  );
}
