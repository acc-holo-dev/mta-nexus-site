import { describe, expect, it } from "vitest";
import {
  formatHistoryIntervalUtc,
  serverHistoryChartSlots,
  serverHistoryBarPercent,
} from "../apps/web/src/lib/server-history-presentation";

describe("complete-window history chart", () => {
  it("keeps missing intervals unknown and preserves a measured zero", () => {
    const buckets = [
      { bucketAt: "2026-10-09T01:00:00Z", observationCount: 2, peakPlayers: 0, maxPlayers: 64 },
    ];
    const slots = serverHistoryChartSlots(
      buckets,
      "2026-10-09T00:30:00Z",
      "2026-10-09T02:30:00Z",
      3600,
    );
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({ observationCount: 0, peakPlayers: null });
    expect(slots[1]).toEqual(buckets[0]);
    expect(slots[2]).toMatchObject({ observationCount: 0, peakPlayers: null });
  });
  it("uses all daily bins for a thirty-day window and does not mutate buckets", () => {
    const bucket = Object.freeze({
      bucketAt: "2026-09-10T00:00:00Z",
      observationCount: 3,
      peakPlayers: 99,
      maxPlayers: 100,
    });
    const slots = serverHistoryChartSlots(
      [bucket],
      "2026-09-09T12:00:00Z",
      "2026-10-09T12:00:00Z",
      86400,
    );
    expect(slots).toHaveLength(31);
    expect(slots[1]).toBe(bucket);
    expect(slots.at(-1)?.bucketAt).toBe("2026-10-09T00:00:00.000Z");
  });
  it.each([
    ["bad", "2026-10-09", 3600],
    ["2026-10-10", "2026-10-09", 3600],
    ["2026-09-01", "2026-10-09", 1],
    ["2026-10-09", "2026-10-09", NaN],
    ["2026-10-09", "2026-10-09", Infinity],
    ["2026-10-09", "2026-10-09", 0],
  ] as const)("rejects invalid or excessive chart ranges %s %s %s", (start, end, width) => {
    expect(serverHistoryChartSlots([], start, end, width)).toEqual([]);
  });
  it("scales peaks without invalid percentages", () => {
    expect(serverHistoryBarPercent(10, 20)).toBe(50);
    expect(serverHistoryBarPercent(30, 20)).toBe(100);
    for (const value of [null, NaN, Infinity, -5])
      expect(serverHistoryBarPercent(value, 20)).toBe(0);
    expect(serverHistoryBarPercent(5, null)).toBe(0);
  });
  it("includes dates in interval labels for multi-day histories", () => {
    expect(formatHistoryIntervalUtc("2026-09-25T07:05:00Z")).toBe("2026-09-25 07:05 UTC");
    expect(formatHistoryIntervalUtc("invalid")).toBe("Unknown time");
  });
});
