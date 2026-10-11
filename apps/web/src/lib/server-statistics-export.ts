import type { ServerStatisticsResult } from "./services/server-statistics-service";

export function serverStatisticsIntervals(report: ServerStatisticsResult) {
  const start = new Date(report.windowStart).getTime(),
    end = new Date(report.windowEnd).getTime();
  const width = report.bucketSeconds * 1000,
    first = Math.floor(start / width) * width;
  const count = Math.ceil((end - first) / width);
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 40 ||
    !Number.isSafeInteger(width) ||
    width < 1
  )
    throw new RangeError("Invalid statistics intervals");
  const buckets = new Map(
    report.buckets.map((bucket) => [new Date(bucket.bucketAt).getTime(), bucket]),
  );
  return Array.from({ length: count }, (_, index) => {
    const time = first + index * width,
      bucket = buckets.get(time);
    return {
      intervalStart: new Date(Math.max(start, time)).toISOString(),
      intervalEnd: new Date(Math.min(end, time + width)).toISOString(),
      observationCount: bucket?.observationCount ?? 0,
      knownPlayerCount: bucket?.knownPlayerCount ?? 0,
      peakPlayers: bucket?.peakPlayers ?? null,
      averagePlayers: bucket?.averagePlayers ?? null,
      maxPlayers: bucket?.maxPlayers ?? null,
    };
  });
}

function cell(value: string | number | boolean | null) {
  if (value === null) return "";
  let text = String(value);
  // Remote mode/map/version strings may be interpreted as spreadsheet formulas.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Formula detection intentionally includes leading ASCII controls in untrusted CSV cells.
  if (typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serverStatisticsCsv(
  report: ServerStatisticsResult,
  format: "buckets" | "observations",
) {
  const metadata = [report.server.id, report.windowStart, report.windowEnd, report.source];
  const columns =
    format === "buckets"
      ? [
          "interval_start_utc",
          "interval_end_utc",
          "observations",
          "known_player_counts",
          "peak_players",
          "average_players",
          "max_capacity",
        ]
      : [
          "observation_id",
          "observed_at_utc",
          "players",
          "capacity",
          "game_mode",
          "map",
          "mta_version",
          "passworded",
          "responding",
        ];
  const rows =
    format === "buckets"
      ? serverStatisticsIntervals(report).map((item) => [
          item.intervalStart,
          item.intervalEnd,
          item.observationCount,
          item.knownPlayerCount,
          item.peakPlayers,
          item.averagePlayers,
          item.maxPlayers,
        ])
      : report.observations
          .slice(0, 25)
          .map((item) => [
            item.id,
            item.observedAt,
            item.currentPlayers,
            item.maxPlayers,
            item.gameMode,
            item.mapName,
            item.mtaVersion,
            item.passworded,
            item.responding,
          ]);
  return `\uFEFF${[
    ["server_id", "window_start_utc", "window_end_utc", "source", ...columns].join(","),
    ...rows.map((row) => [...metadata, ...row].map(cell).join(",")),
  ].join("\r\n")}\r\n`;
}
