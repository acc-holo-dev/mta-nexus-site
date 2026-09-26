import { Activity, BarChart3, Clock3 } from "lucide-react";
import {
  formatObservationTimeUtc,
  selectServerHistoryChartPoints,
  serverHistoryBarPercent,
} from "../lib/server-history-presentation";
import type { ServerHistoryResult } from "../lib/services/server-history-service";
import { getDictionary, type Locale } from "../lib/i18n";

function metric(value: number | null) {
  return value == null ? "—" : String(value);
}

export function ServerHistoryPanel({
  history,
  locale = "en",
}: {
  history: ServerHistoryResult | null;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).serverHistory;

  if (!history) {
    return (
      <section
        className="nexus-panel p-5 md:p-6"
        aria-labelledby="server-history-title"
      >
        <div className="flex items-start gap-3">
          <Clock3
            className="mt-0.5 h-4 w-4 shrink-0 text-faint"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2
              id="server-history-title"
              className="text-sm font-bold uppercase tracking-wider text-primary"
            >
              {copy.title}
            </h2>
            <p className="text-xs text-muted">{copy.unavailable}</p>
          </div>
        </div>
      </section>
    );
  }

  const points = selectServerHistoryChartPoints(history.observations, 24);
  const peak = history.summary.peakPlayers;

  return (
    <section
      className="nexus-panel space-y-5 p-5 md:p-6"
      aria-labelledby="server-history-title"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [copy.samples, history.summary.observationCount],
          [copy.peakPlayers, metric(history.summary.peakPlayers)],
          [copy.averagePlayers, metric(history.summary.averagePlayers)],
          [copy.latestStored, metric(history.summary.latestPlayers)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-base bg-inset p-3">
            <div className="font-label uppercase text-faint">{label}</div>
            <div className="mt-1 text-xl font-black text-primary">{value}</div>
          </div>
        ))}
      </div>

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base bg-inset p-5 text-xs text-muted">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
            <p>{copy.empty}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>{copy.window}</span>
            <span>UTC</span>
          </div>
          <ol
            className="flex h-32 items-end gap-1 rounded-lg border border-base bg-inset px-3 pb-2 pt-4"
            aria-label={copy.chartLabel}
          >
            {points.map((point, index) => {
              const percent = serverHistoryBarPercent(
                point.currentPlayers,
                peak,
              );
              const label = formatObservationTimeUtc(point.observedAt);
              return (
                <li
                  key={`${point.observedAt}-${index}`}
                  className="flex h-full min-w-0 flex-1 items-end"
                >
                  <div className="flex h-full w-full items-end">
                    <div
                      className={
                        point.currentPlayers == null
                          ? "min-h-0.5 w-full rounded-t bg-[var(--nexus-text-faint)]/50"
                          : "min-h-0.5 w-full rounded-t bg-[var(--nexus-accent)]/80"
                      }
                      style={{ height: `${Math.max(percent, 2)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="sr-only">
                    {label}:{" "}
                    {point.currentPlayers == null
                      ? copy.playerCountUnknown
                      : `${point.currentPlayers} ${copy.players}`}
                    {point.maxPlayers == null
                      ? ""
                      : ` ${point.maxPlayers} ${copy.slots}`}
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
    </section>
  );
}
