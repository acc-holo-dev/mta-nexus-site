import {
  serverObservationRepository,
  type ServerStatisticsAccess,
  type ServerStatisticsTarget,
} from "@nexus/db";
import { serverHistoryWindows } from "../server-history-window";
import type { ServerStatisticsQuery } from "../server-statistics-contract";
import type { ServerObservationBrowserQuery } from "../server-observation-browser-contract";

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export const serverStatisticsService = {
  async observations(
    target: ServerStatisticsTarget,
    access: ServerStatisticsAccess,
    query: ServerObservationBrowserQuery,
  ) {
    const result = await serverObservationRepository.pageObservations(
      target,
      access,
      serverHistoryWindows[query.window],
      {
        query: query.query,
        players: query.players,
        password: query.password,
        responding: query.responding,
        cursor: query.cursor,
        ...(query.end ? { end: new Date(query.end) } : { end: undefined }),
      },
    );
    if (!result) return null;
    const encode = (point: typeof result.nextCursor, direction: "older" | "newer") =>
      point ? JSON.stringify({ ...point, context: result.context, direction, version: 1 }) : null;
    return {
      server: result.server,
      source: "mta_master" as const,
      absenceMeansOffline: false as const,
      window: query.window,
      windowStart: result.windowStart.toISOString(),
      windowEnd: result.windowEnd.toISOString(),
      observations: result.observations,
      pageSize: 25,
      nextCursor: encode(result.nextCursor, "older"),
      previousCursor: encode(result.previousCursor, "newer"),
      collectionEligible:
        result.server.status === "active" && result.server.visibility !== "private",
    };
  },
  async read(
    target: ServerStatisticsTarget,
    access: ServerStatisticsAccess,
    query: ServerStatisticsQuery,
  ) {
    const result = await serverObservationRepository.readStatistics(
      target,
      access,
      serverHistoryWindows[query.window],
      {
        ...(query.end ? { end: new Date(query.end) } : {}),
        ...(query.before ? { before: query.before } : {}),
      },
    );
    if (!result) return null;
    const summary = (value: typeof result.summary) => ({
      ...value,
      observedFrom: value.observedFrom?.toISOString() ?? null,
      observedTo: value.observedTo?.toISOString() ?? null,
      knownPlayerPercent: value.observationCount
        ? round((100 * value.knownPlayerCount) / value.observationCount)
        : null,
    });
    const average = result.summary.averagePlayers,
      previous = result.previousSummary.averagePlayers;
    return {
      server: result.server,
      source: "mta_master" as const,
      absenceMeansOffline: false as const,
      window: query.window,
      windowStart: result.windowStart.toISOString(),
      windowEnd: result.windowEnd.toISOString(),
      previousStart: result.previousStart.toISOString(),
      bucketSeconds: result.bucketSeconds,
      summary: summary(result.summary),
      previousSummary: summary(result.previousSummary),
      averagePlayerChange: average == null || previous == null ? null : round(average - previous),
      averagePlayerPercentChange:
        average == null || previous == null || previous === 0
          ? null
          : round((100 * (average - previous)) / previous),
      buckets: result.buckets.map((bucket) => ({
        ...bucket,
        bucketAt: bucket.bucketAt.toISOString(),
        observedFrom: bucket.observedFrom?.toISOString() ?? null,
        observedTo: bucket.observedTo?.toISOString() ?? null,
      })),
      observations: result.observations.map((item) => ({
        ...item,
        observedAt: item.observedAt.toISOString(),
        gameMode: item.gameMode?.slice(0, 240) ?? null,
        mapName: item.mapName?.slice(0, 240) ?? null,
        mtaVersion: item.mtaVersion?.slice(0, 120) ?? null,
      })),
      pageSize: 25,
      nextCursor: result.nextCursor,
      collectionEligible:
        result.server.status === "active" && result.server.visibility !== "private",
    };
  },
};

export type ServerStatisticsResult = NonNullable<
  Awaited<ReturnType<typeof serverStatisticsService.read>>
>;
export type ServerObservationBrowserResult = NonNullable<
  Awaited<ReturnType<typeof serverStatisticsService.observations>>
>;
