import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatHistoryIntervalUtc } from "../../src/features/servers/server-history-presentation";

/** Wave 198: invalid history interval labels use the shared unknown marker, not English prose. */
describe("formatHistoryIntervalUtc locale honesty surface", () => {
  it("keeps valid UTC labels and remaps invalid timestamps", () => {
    expect(formatHistoryIntervalUtc("2026-09-25T07:05:00Z", "en")).toBe("2026-09-25 07:05 UTC");
    expect(formatHistoryIntervalUtc("invalid", "en")).toBe("—");
    expect(formatHistoryIntervalUtc("invalid", "ru")).toBe("—");
  });

  it("passes locale from the history panel", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "site/src/features/servers/server/server-history-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("formatHistoryIntervalUtc(point.bucketAt, locale)");
    expect(panel).toContain("formatHistoryIntervalUtc(history.windowStart, locale)");
    expect(panel).not.toContain('return "Unknown time"');
  });
});
