import { EmptyState, ErrorState } from "@nexus/ui";
import { Activity, BarChart3 } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { formatUnknown } from "../../../lib/i18n/unknown";
import type { ServerHistoryResult } from "../../../lib/services/servers/server-history-service";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellStack3 } from "../../shell/page-shell";
import {
  typeFlexCenterGap2,
  typeFlexMinWrapGap2,
  typeIconAccent,
  typeLabelUpperFaint,
  typeMinSpace1,
  typeMinSpace3,
  typeXsMuted,
} from "../../shell/type-shell";
import {
  formatHistoryIntervalUtc,
  serverHistoryBarPercent,
  serverHistoryChartSlots,
} from "../server-history-presentation";
import { serverStatisticsCopy } from "../server-statistics-copy";

function metric(locale: Locale, value: number | null) {
  return formatUnknown(locale, value);
}

const periodLinkClass =
  "inline-flex min-h-11 items-center rounded-lg border border-base px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

export function ServerHistoryPanel({
  history,
  locale = "en",
  retryHref,
}: {
  history: ServerHistoryResult | null;
  locale?: Locale;
  retryHref?: string;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.serverHistory;

  if (!history) {
    return (
      <section aria-labelledby="server-history-title" className={pageShellStack3}>
        <h2
          id="server-history-title"
          className="text-sm font-bold uppercase tracking-wider text-primary"
        >
          {copy.title}
        </h2>
        <ErrorState
          title={copy.unavailable}
          description={copy.unavailableHint}
          action={
            retryHref ? (
              <Link href={retryHref} className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            ) : undefined
          }
        />
      </section>
    );
  }

  const points = serverHistoryChartSlots(
    history.buckets,
    history.windowStart,
    history.windowEnd,
    history.bucketSeconds,
  );
  const peak = history.summary.peakPlayers;

  return (
    <section
      className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-5 md:p-6"
      aria-labelledby="server-history-title"
    >
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className={typeMinSpace1}>
          <div className={typeFlexCenterGap2}>
            <BarChart3 className={typeIconAccent} aria-hidden="true" />
            <h2
              id="server-history-title"
              className="text-sm font-bold uppercase tracking-wider text-primary"
            >
              {copy.title}
            </h2>
          </div>
          <p className="max-w-2xl text-xs text-muted">{copy.description}</p>
        </div>
        <span className="w-fit rounded-full border border-[color:var(--nexus-accent)]/20 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
          {copy.recordedOnly}
        </span>
      </div>

      <nav aria-label={copy.chooseWindow} className={typeFlexMinWrapGap2}>
        {(
          [
            ["24h", copy.period24h],
            ["7d", copy.period7d],
            ["30d", copy.period30d],
          ] as const
        ).map(([window, label]) => (
          <Link
            key={window}
            href={`/servers/${encodeURIComponent(history.server.slug)}?history=${window}#server-history-title`}
            aria-current={history.window === window ? "true" : undefined}
            className={`${periodLinkClass} ${history.window === window ? "bg-accent-soft text-accent" : "bg-inset text-secondary"}`}
          >
            {label}
          </Link>
        ))}
        <Link
          href={`/servers/${encodeURIComponent(history.server.slug)}/statistics?window=${history.window}`}
          className={`${periodLinkClass} text-accent`}
        >
          {serverStatisticsCopy(locale).open}
        </Link>
      </nav>
      <p className={typeXsMuted}>{copy.summaryScope}</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [copy.samples, history.summary.observationCount],
          [copy.peakPlayers, metric(locale, history.summary.peakPlayers)],
          [copy.averagePlayers, metric(locale, history.summary.averagePlayers)],
          [copy.latestStored, metric(locale, history.summary.latestPlayers)],
        ].map(([label, value]) => (
          <div key={String(label)} className="min-w-0 rounded-lg border border-base bg-inset p-3">
            <div className={typeLabelUpperFaint}>{label}</div>
            <div className="mt-1 break-words text-xl font-black text-primary">{value}</div>
          </div>
        ))}
      </div>

      {history.summary.observationCount === 0 || points.length === 0 ? (
        <EmptyState title={copy.empty} description={copy.emptyHint} />
      ) : (
        <div className={typeMinSpace3}>
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>
              {copy.window}:{" "}
              {history.bucketSeconds === 3600
                ? copy.intervalHour
                : history.bucketSeconds === 21600
                  ? copy.intervalSixHours
                  : copy.intervalDay}
            </span>
            <span>{copy.timezoneUtc}</span>
          </div>
          <ol
            className="flex h-32 items-end gap-1 overflow-x-auto rounded-lg border border-base bg-inset px-3 pb-2 pt-4"
            aria-label={copy.chartLabel}
          >
            {points.map((point) => {
              const percent = serverHistoryBarPercent(point.peakPlayers, peak);
              const label = formatHistoryIntervalUtc(point.bucketAt, locale);
              return (
                <li key={point.bucketAt} className="flex h-full min-w-0 flex-1 items-end">
                  <div className="flex h-full w-full items-end">
                    <div
                      className={
                        point.peakPlayers == null
                          ? "min-h-0.5 w-full rounded-t bg-[var(--nexus-text-faint)]/50"
                          : "min-h-0.5 w-full rounded-t bg-[var(--nexus-accent)]/80"
                      }
                      style={{ height: `${Math.max(percent, 2)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="sr-only">
                    {label}: {point.observationCount} {copy.samples};{" "}
                    {point.peakPlayers == null
                      ? copy.playerCountUnknown
                      : `${point.peakPlayers} ${copy.players}`}
                    {point.maxPlayers == null ? "" : ` ${point.maxPlayers} ${copy.slots}`}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.barsDescription}</span>
          </div>
        </div>
      )}
      {points.length > 0 && history.summary.observationCount > 0 && (
        <p className="flex flex-wrap justify-between gap-2 text-[11px] text-faint">
          <span>{formatHistoryIntervalUtc(history.windowStart, locale)}</span>
          <span>{formatHistoryIntervalUtc(history.windowEnd, locale)}</span>
        </p>
      )}
    </section>
  );
}
