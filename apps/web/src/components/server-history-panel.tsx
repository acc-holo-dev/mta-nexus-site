import { Activity, BarChart3, Clock3 } from "lucide-react";
import {
  formatObservationTimeUtc,
  selectServerHistoryChartPoints,
  serverHistoryBarPercent,
} from "../lib/server-history-presentation";
import type { serverHistoryService } from "../lib/services/server-history-service";

type History = NonNullable<
  Awaited<ReturnType<typeof serverHistoryService.getHistory>>
>;

function metric(value: number | null) {
  return value == null ? "—" : String(value);
}

export function ServerHistoryPanel({ history }: { history: History }) {
  const points = selectServerHistoryChartPoints(history.observations, 24);
  const peak = history.summary.peakPlayers;

  return (
    <section
      className="nexus-panel p-5 md:p-6 space-y-5"
      aria-labelledby="server-history-title"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2
              id="server-history-title"
              className="text-sm font-bold uppercase tracking-wider text-white"
            >
              Observed player history
            </h2>
          </div>
          <p className="max-w-2xl text-xs text-neutral-400">
            Stored observations from the official MTA directory. Missing
            observations do not mean the server was offline.
          </p>
        </div>
        <span className="w-fit rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
          Recorded observations only
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-base bg-neutral-900/70 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Samples
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {history.summary.observationCount}
          </div>
        </div>
        <div className="rounded-lg border border-base bg-neutral-900/70 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Peak players
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {metric(history.summary.peakPlayers)}
          </div>
        </div>
        <div className="rounded-lg border border-base bg-neutral-900/70 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Average players
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {metric(history.summary.averagePlayers)}
          </div>
        </div>
        <div className="rounded-lg border border-base bg-neutral-900/70 p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Latest stored
          </div>
          <div className="mt-1 text-xl font-black text-white">
            {metric(history.summary.latestPlayers)}
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/40 p-5 text-xs text-neutral-400">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
            <p>
              No stored observations are available for the last 24 hours.
              History appears only after the separate NEXUS collector records
              confirmed master-list observations.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>24-hour stored sample window</span>
            <span>UTC</span>
          </div>
          <ol
            className="flex h-32 items-end gap-1 rounded-lg border border-base bg-neutral-950/50 px-3 pt-4 pb-2"
            aria-label="Stored player observations for the last 24 hours"
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
                      className="w-full min-h-0.5 rounded-t bg-blue-400/80"
                      style={{ height: `${Math.max(percent, 2)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="sr-only">
                    {label}:{" "}
                    {point.currentPlayers == null
                      ? "player count unknown"
                      : `${point.currentPlayers} players`}
                    {point.maxPlayers == null
                      ? ""
                      : ` of ${point.maxPlayers} slots`}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              Bars are sampled evenly from stored observations and scaled to
              the peak stored player count, not to server capacity.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
