import { describe, expect, it } from "vitest";
import {
  isInsideRetentionWindow,
  retentionDayIndex,
  retentionWindowBounds,
} from "../apps/web/src/lib/retention-activation-windows";

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

describe("retention activation windows (GROW-01 definition)", () => {
  it("indexes days from t0 without treating any return in week 1 as D7", () => {
    expect(retentionDayIndex(T0, T0)).toBe(0);
    expect(retentionDayIndex(T0, T0 + 6 * 86_400_000)).toBe(6);
    expect(retentionDayIndex(T0, T0 + 7 * 86_400_000)).toBe(7);
    expect(isInsideRetentionWindow("D7", T0, T0 + 3 * 86_400_000)).toBe(false);
    expect(isInsideRetentionWindow("D7", T0, T0 + 7 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("D7", T0, T0 + 8 * 86_400_000 - 1)).toBe(true);
    expect(isInsideRetentionWindow("D7", T0, T0 + 8 * 86_400_000)).toBe(false);
  });

  it("keeps D30 as [t0+30d, t0+31d) and W1/W4 as distinct multi-day windows", () => {
    expect(isInsideRetentionWindow("D30", T0, T0 + 30 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("D30", T0, T0 + 29 * 86_400_000)).toBe(false);
    expect(isInsideRetentionWindow("W1", T0, T0 + 1 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("W1", T0, T0)).toBe(false);
    expect(isInsideRetentionWindow("W1", T0, T0 + 7 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("W4", T0, T0 + 22 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("W4", T0, T0 + 28 * 86_400_000)).toBe(true);
    expect(isInsideRetentionWindow("W4", T0, T0 + 21 * 86_400_000)).toBe(false);
    expect(isInsideRetentionWindow("W4", T0, T0 + 29 * 86_400_000)).toBe(false);
  });

  it("exposes exclusive end bounds matching the day windows", () => {
    expect(retentionWindowBounds("D7", T0)).toEqual({
      startMs: T0 + 7 * 86_400_000,
      endMsExclusive: T0 + 8 * 86_400_000,
    });
    expect(retentionWindowBounds("W4", T0)).toEqual({
      startMs: T0 + 22 * 86_400_000,
      endMsExclusive: T0 + 29 * 86_400_000,
    });
  });
});
