import type { ServerObservationBrowserResult } from "../../apps/web/src/lib/services/server-statistics-service";
import { statisticsFixture } from "./server-statistics-fixture";
export function observationBrowserFixture(): ServerObservationBrowserResult {
  const report = statisticsFixture();
  const cursor = JSON.stringify({
    createdAt: "2026-10-10T01:00:00.123456Z",
    id: "obs_1",
    context: "a".repeat(64),
    direction: "older",
    version: 1,
  });
  return {
    server: report.server,
    source: report.source,
    absenceMeansOffline: false,
    window: report.window,
    windowStart: report.windowStart,
    windowEnd: report.windowEnd,
    observations: report.observations,
    pageSize: 25,
    nextCursor: cursor,
    previousCursor: null,
    collectionEligible: report.collectionEligible,
  };
}
