import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "../lib/i18n";
import type { ServerStatisticsResult } from "../lib/services/server-statistics-service";
import { serverStatisticsCopy } from "../lib/server-statistics-copy";
import { serverStatisticsHref } from "../lib/server-statistics-contract";
import { serverStatisticsIntervals } from "../lib/server-statistics-export";
import { serverHistoryBarPercent } from "../lib/server-history-presentation";
import { ServerStatisticsExportButton } from "./server-statistics-export-button";

function StatisticsScrollArea({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This named overflow region needs keyboard focus for horizontal table scrolling.
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </section>
  );
}

export function ServerStatisticsPanel({
  report,
  locale,
  path,
  managed,
  before,
}: {
  report: ServerStatisticsResult;
  locale: Locale;
  path: string;
  managed: boolean;
  before?: string;
}) {
  const copy = serverStatisticsCopy(locale),
    intervals = serverStatisticsIntervals(report);
  const state = { window: report.window, end: report.windowEnd };
  const metric = (value: number | null) => (value == null ? copy.unknown : String(value));
  const boolean = (value: boolean | null) =>
    value == null ? copy.unknown : value ? copy.yes : copy.no;
  const time = (value: string) =>
    new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB", {
      timeZone: "UTC",
      dateStyle: "medium",
      timeStyle: "medium",
    });
  const exportPath = `${managed ? "/api/workspace" : "/api"}/servers/${encodeURIComponent(report.server.id)}/statistics/export`;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href={
            managed
              ? `/workspace/servers/${encodeURIComponent(report.server.id)}`
              : `/servers/${encodeURIComponent(report.server.slug)}`
          }
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← {managed ? copy.management : copy.back}
        </Link>
        <h1 className="text-2xl font-black text-primary">{copy.title}</h1>
        <p className="break-words text-lg font-semibold text-primary">{report.server.name}</p>
        <p className="text-sm text-muted">{copy.description}</p>
        {managed && <p className="text-xs text-muted">{copy.private}</p>}
        <nav aria-label={copy.windows} className="flex flex-wrap gap-2">
          {(
            [
              ["24h", copy.period24h],
              ["7d", copy.period7d],
              ["30d", copy.period30d],
            ] as const
          ).map(([window, label]) => (
            <Link
              key={window}
              href={serverStatisticsHref(path, { window })}
              aria-current={report.window === window ? "page" : undefined}
              className={`min-h-11 rounded-lg border border-base px-3 py-2 text-sm font-semibold ${report.window === window ? "bg-accent-soft text-accent" : "bg-inset text-secondary"}`}
            >
              {label}
            </Link>
          ))}
          <Link
            href={serverStatisticsHref(path, { window: report.window })}
            className="min-h-11 px-3 py-2 text-sm text-accent underline"
          >
            {copy.refresh}
          </Link>
        </nav>
        <p className="text-xs text-muted">
          {copy.snapshot}: <time dateTime={report.windowEnd}>{time(report.windowEnd)} UTC</time>
        </p>
        <p className="text-xs text-muted">{copy.snapshotScope}</p>
      </header>
      <section className="nexus-panel space-y-3 p-5">
        <h2 id="server-statistics-comparison" className="text-lg font-bold text-primary">
          {copy.comparison}
        </h2>
        <p className="text-sm text-muted">{copy.scope}</p>
        {report.server.endpointRevision > 0 && (
          <p className="text-sm text-muted">{copy.lifetime}</p>
        )}
        {!report.collectionEligible && <p className="text-sm text-muted">{copy.paused}</p>}
        <StatisticsScrollArea labelledBy="server-statistics-comparison">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{copy.comparison}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="p-2">
                  {copy.windows}
                </th>
                {[copy.samples, copy.known, copy.peak, copy.average].map((label) => (
                  <th key={label} scope="col" className="p-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [copy.current, report.windowStart, report.windowEnd, report.summary],
                  [copy.previous, report.previousStart, report.windowStart, report.previousSummary],
                ] as const
              ).map(([label, from, to, summary]) => (
                <tr key={label} className="border-t border-base text-secondary">
                  <th scope="row" className="min-w-48 p-2 font-normal">
                    <span className="font-semibold text-primary">{label}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {time(from)} — {time(to)} UTC
                    </span>
                  </th>
                  <td className="p-2">{summary.observationCount}</td>
                  <td className="p-2">
                    {summary.knownPlayerCount}
                    {summary.knownPlayerPercent == null ? "" : ` (${summary.knownPlayerPercent}%)`}
                  </td>
                  <td className="p-2">{metric(summary.peakPlayers)}</td>
                  <td className="p-2">{metric(summary.averagePlayers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StatisticsScrollArea>
        <p className="text-sm text-secondary">
          {copy.change}:{" "}
          {report.averagePlayerChange == null
            ? copy.unknown
            : `${report.averagePlayerChange > 0 ? "+" : ""}${report.averagePlayerChange}`}
          {report.averagePlayerPercentChange == null
            ? ""
            : ` (${report.averagePlayerPercentChange > 0 ? "+" : ""}${report.averagePlayerPercentChange}%)`}
        </p>
      </section>
      <section className="nexus-panel space-y-3 p-5" aria-labelledby="server-statistics-chart">
        <h2 id="server-statistics-chart" className="text-lg font-bold text-primary">
          {copy.chart}
        </h2>
        {report.summary.observationCount === 0 ? (
          <p className="text-sm text-muted">{copy.empty}</p>
        ) : (
          <>
            <ol
              className="flex h-36 items-end gap-1 rounded-lg bg-inset p-3"
              aria-label={copy.chart}
            >
              {intervals.map((interval) => (
                <li key={interval.intervalStart} className="flex h-full min-w-0 flex-1 items-end">
                  <div
                    aria-hidden="true"
                    className={`min-h-0.5 w-full rounded-t ${interval.peakPlayers == null ? "bg-[var(--nexus-text-faint)]/50" : "bg-[var(--nexus-accent)]/80"}`}
                    style={{
                      height: `${Math.max(2, serverHistoryBarPercent(interval.peakPlayers, report.summary.peakPlayers))}%`,
                    }}
                  />
                  <span className="sr-only">
                    {time(interval.intervalStart)} UTC: {interval.observationCount} {copy.samples};{" "}
                    {copy.peak}: {metric(interval.peakPlayers)}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted">{copy.chartScope}</p>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <time dateTime={report.windowStart}>{time(report.windowStart)} UTC</time>
          <time dateTime={report.windowEnd}>{time(report.windowEnd)} UTC</time>
        </div>
      </section>
      <section
        className="nexus-panel space-y-3 p-5"
        aria-labelledby="server-statistics-observations"
      >
        <h2 id="server-statistics-observations" className="text-lg font-bold text-primary">
          {copy.observations}
        </h2>
        <p className="text-sm text-muted">{copy.observationsScope}</p>
        {report.observations.length === 0 ? (
          <p className="text-sm text-muted">{before ? copy.endOfPage : copy.empty}</p>
        ) : (
          <StatisticsScrollArea labelledBy="server-statistics-observations">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{copy.observations}</caption>
              <thead>
                <tr className="text-muted">
                  {[
                    copy.time,
                    copy.players,
                    copy.capacity,
                    copy.mode,
                    copy.map,
                    copy.version,
                    copy.password,
                    copy.responding,
                  ].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.observations.map((item) => (
                  <tr key={item.id} className="border-t border-base text-secondary">
                    <th scope="row" className="whitespace-nowrap p-2 font-normal">
                      <time dateTime={item.observedAt}>{time(item.observedAt)}</time>
                    </th>
                    <td className="p-2">{metric(item.currentPlayers)}</td>
                    <td className="p-2">{metric(item.maxPlayers)}</td>
                    {[item.gameMode, item.mapName, item.mtaVersion].map((text, index) => (
                      <td
                        key={["mode", "map", "version"][index]}
                        className="min-w-24 max-w-60 break-words p-2"
                      >
                        {text ?? copy.unknown}
                      </td>
                    ))}
                    <td className="p-2">{boolean(item.passworded)}</td>
                    <td className="p-2">{boolean(item.responding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StatisticsScrollArea>
        )}
        <nav
          aria-label={copy.navigation}
          className="flex flex-wrap gap-4 text-sm font-semibold text-accent"
        >
          {before && (
            <Link href={serverStatisticsHref(path, state)} className="min-h-11 py-2 underline">
              {copy.latest}
            </Link>
          )}
          {report.nextCursor && (
            <Link
              href={serverStatisticsHref(path, { ...state, before: report.nextCursor })}
              className="min-h-11 py-2 underline"
            >
              {copy.earlier} →
            </Link>
          )}
        </nav>
      </section>
      <section className="nexus-panel space-y-3 p-5">
        <div className="flex flex-wrap gap-3">
          <ServerStatisticsExportButton
            url={serverStatisticsHref(exportPath, { ...state, format: "buckets" })}
            label={copy.export}
            locale={locale}
          />
          <ServerStatisticsExportButton
            url={serverStatisticsHref(exportPath, { ...state, before, format: "observations" })}
            label={copy.exportSamples}
            locale={locale}
            disabled={report.observations.length === 0}
          />
        </div>
        <p className="text-sm text-muted">{copy.exportScope}</p>
      </section>
    </div>
  );
}
