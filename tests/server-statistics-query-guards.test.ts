import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerStatisticsQueryDbMock } = await import(
    "./helpers/server-statistics-query-harness"
  );
  return createServerStatisticsQueryDbMock();
});

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
import {
  installServerStatisticsQueryHooks,
  serverStatisticsQueryEnd as end,
  serverStatisticsQueryState as state,
} from "./helpers/server-statistics-query-harness";

const repository = new ServerObservationRepository();
installServerStatisticsQueryHooks();

it("resolves a case-scoped anchor at PostgreSQL microsecond precision and returns a sentinel cursor", async () => {
  state.rows.splice(3, 0, [["obs_anchor", "2026-10-10T23:59:00.000001Z"]]);
  state.rows[4] = Array.from({ length: 26 }, (_, i) => [
    `obs_${i}`,
    "2026-10-10T23:58:00Z",
    i,
    64,
    null,
    null,
    null,
    null,
    null,
  ]);
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 24, {
    end,
    before: "obs_anchor",
  });
  expect(report?.observations).toHaveLength(25);
  expect(report?.nextCursor).toBe("obs_24");
  expect(state.queries[3].sql).toContain("SS.US");
  expect(state.queries[3].params).toContain("server");
  expect(state.queries[4].params).toContain("2026-10-10T23:59:00.000001Z");
  expect(state.queries[4].sql).toContain(
    '("server_observations"."observed_at", "server_observations"."id") <',
  );
});
it("rejects foreign, out-of-period or removed anchors instead of returning a misleading empty page", async () => {
  state.rows.splice(3, 0, []);
  await expect(
    repository.readStatistics({ id: "server" }, { kind: "public" }, 24, {
      end,
      before: "obs_foreign",
    }),
  ).rejects.toMatchObject({ code: "SERVER_OBSERVATION_PAGE_EXPIRED", statusCode: 404 });
  expect(state.queries).toHaveLength(4);
});
it.each([new Date(NaN), new Date(end.getTime() + 1), new Date(end.getTime() - 91 * 86_400_000)])(
  "rejects unbounded period ends before any query",
  async (date) => {
    await expect(
      repository.readStatistics({ id: "server" }, { kind: "public" }, 24, { end: date }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toEqual([]);
  },
);
it.each([
  [24, 3600],
  [168, 21600],
  [720, 86400],
] as const)("bounds interval grouping for %s hours", async (hours, width) => {
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, hours);
  if (!report) throw new Error("Missing statistics");
  expect(report?.bucketSeconds).toBe(width);
  expect(report.windowEnd.getTime() - report.windowStart.getTime()).toBe(hours * 3_600_000);
});
