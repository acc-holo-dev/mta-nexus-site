import { describe, expect, it } from "vitest";
import {
  formatObservationTimeUtc,
  selectServerHistoryChartPoints,
  serverHistoryBarPercent,
} from "../apps/web/src/lib/server-history-presentation";

function points(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    observedAt: new Date(
      Date.UTC(2026, 8, 25, 0, index, 0),
    ).toISOString(),
    currentPlayers: index,
    maxPlayers: 64,
  }));
}

describe("server history presentation", () => {
  it("keeps small histories intact", () => {
    const source = points(4);
    expect(selectServerHistoryChartPoints(source, 24)).toEqual(source);
  });

  it("downsamples long histories while preserving both ends", () => {
    const source = points(100);
    const selected = selectServerHistoryChartPoints(source, 24);

    expect(selected).toHaveLength(24);
    expect(selected[0]).toEqual(source[0]);
    expect(selected.at(-1)).toEqual(source.at(-1));
  });

  it("bounds chart density and avoids invalid percentages", () => {
    expect(selectServerHistoryChartPoints(points(100), 500)).toHaveLength(48);
    expect(selectServerHistoryChartPoints(points(100), 1)).toHaveLength(2);
    expect(serverHistoryBarPercent(10, 20)).toBe(50);
    expect(serverHistoryBarPercent(30, 20)).toBe(100);
    expect(serverHistoryBarPercent(null, 20)).toBe(0);
    expect(serverHistoryBarPercent(5, null)).toBe(0);
  });

  it("formats timestamps deterministically in UTC", () => {
    expect(formatObservationTimeUtc("2026-09-25T07:05:00.000Z")).toBe(
      "07:05 UTC",
    );
    expect(formatObservationTimeUtc("invalid")).toBe("Unknown time");
  });
});
