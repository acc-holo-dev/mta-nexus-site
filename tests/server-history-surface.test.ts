import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server history detail surface", () => {
  it("loads live status and stored history in parallel in the server component", () => {
    const page = read(
      "apps/web/src/app/servers/[slug]/page.tsx",
    );

    expect(page).toContain("Promise.all([");
    expect(page).toContain(
      "mtaMasterDirectoryService.getDirectory()",
    );
    expect(page).toContain(
      'serverHistoryService.getHistory(server.id, "24h")',
    );
    expect(page).toContain("<ServerHistoryPanel");
    expect(page).toContain("history={history}");
    expect(page).toContain("locale={locale}");
    expect(page).not.toContain('"use client"');
    expect(page).not.toContain('fetch("/api/servers/');
  });

  it("keeps empty, unavailable and unknown history states distinct through localized copy", () => {
    const panel = read(
      "apps/web/src/components/server-history-panel.tsx",
    );

    expect(panel).toContain(
      "getDictionary(locale).serverHistory",
    );
    expect(panel).toContain("copy.unavailable");
    expect(panel).toContain("copy.empty");
    expect(panel).toContain("copy.barsDescription");
    expect(panel).toContain("copy.description");
    expect(panel).toContain(
      "selectServerHistoryChartPoints(history.observations, 24)",
    );
  });

  it("uses semantic accessible chart text instead of a client chart library", () => {
    const panel = read(
      "apps/web/src/components/server-history-panel.tsx",
    );

    expect(panel).toContain("aria-label={copy.chartLabel}");
    expect(panel).toContain('className="sr-only"');
    expect(panel).not.toContain("recharts");
    expect(panel).not.toContain("chart.js");
  });
});
