/**
 * Pure GROW-01 retention window helpers (docs/RETENTION-PLAN.md §4.2).
 * Definition checks only — not a live analytics pipeline or pilot.
 */

export type RetentionDayWindow = "D7" | "D30" | "W1" | "W4";

const DAY_MS = 24 * 60 * 60 * 1000;

function assertFiniteInstant(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be a finite epoch ms`);
  return value;
}

/** Inclusive calendar-day index after t0: day 0 is [t0, t0+1d). */
export function retentionDayIndex(t0Ms: number, atMs: number): number {
  const t0 = assertFiniteInstant(t0Ms, "t0Ms");
  const at = assertFiniteInstant(atMs, "atMs");
  return Math.floor((at - t0) / DAY_MS);
}

/**
 * D7 / D30 are single-day observation windows:
 * D7  → [t0+7d, t0+8d)
 * D30 → [t0+30d, t0+31d)
 *
 * W1 / W4 are multi-day windows (pilot briefs may refine inclusivity; here day
 * indices match RETENTION-PLAN: W1 days 1–7, W4 days 22–28 inclusive).
 */
export function isInsideRetentionWindow(
  window: RetentionDayWindow,
  t0Ms: number,
  atMs: number,
): boolean {
  const day = retentionDayIndex(t0Ms, atMs);
  switch (window) {
    case "D7":
      return day === 7;
    case "D30":
      return day === 30;
    case "W1":
      return day >= 1 && day <= 7;
    case "W4":
      return day >= 22 && day <= 28;
    default: {
      const _exhaustive: never = window;
      return _exhaustive;
    }
  }
}

export function retentionWindowBounds(
  window: RetentionDayWindow,
  t0Ms: number,
): { startMs: number; endMsExclusive: number } {
  const t0 = assertFiniteInstant(t0Ms, "t0Ms");
  switch (window) {
    case "D7":
      return { startMs: t0 + 7 * DAY_MS, endMsExclusive: t0 + 8 * DAY_MS };
    case "D30":
      return { startMs: t0 + 30 * DAY_MS, endMsExclusive: t0 + 31 * DAY_MS };
    case "W1":
      return { startMs: t0 + 1 * DAY_MS, endMsExclusive: t0 + 8 * DAY_MS };
    case "W4":
      return { startMs: t0 + 22 * DAY_MS, endMsExclusive: t0 + 29 * DAY_MS };
    default: {
      const _exhaustive: never = window;
      return _exhaustive;
    }
  }
}
