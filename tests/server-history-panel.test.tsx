import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ServerHistoryPanel } from "../apps/web/src/components/server-history-panel";
const history = {
  server: { id: "server", name: "Server", slug: "server" },
  source: "mta_master" as const,
  window: "30d" as const,
  coverage: "stored_confirmed_observations" as const,
  collectionMode: "collector_required" as const,
  absenceMeansOffline: false as const,
  windowStart: "2026-09-09T12:00:00Z",
  windowEnd: "2026-10-09T12:00:00Z",
  bucketSeconds: 86400,
  samplesTruncated: true,
  sampleLimit: 500,
  summary: {
    observationCount: 8000,
    knownPlayerCount: 7900,
    peakPlayers: 99,
    averagePlayers: 32.5,
    observedFrom: "2026-09-10T00:00:00Z",
    observedTo: "2026-10-09T12:00:00Z",
    latestPlayers: 0,
    latestMaxPlayers: 100,
  },
  buckets: [
    {
      bucketAt: "2026-09-10T00:00:00Z",
      observationCount: 10,
      knownPlayerCount: 10,
      peakPlayers: 99,
      averagePlayers: 32.5,
      maxPlayers: 100,
    },
  ],
  observations: [],
};
it.each(["en", "ru"] as const)(
  "renders complete-window peaks, unknown gaps and accessible period links in %s",
  (locale) => {
    const html = renderToStaticMarkup(<ServerHistoryPanel history={history} locale={locale} />);
    expect(html).toContain("8000");
    expect(html).toContain("99");
    expect(html).toContain("2026-09-10 00:00 UTC");
    expect(html).toContain('href="/servers/server?history=7d#server-history-title"');
    const selectedLink = html.match(
      /<a\b[^>]*href="\/servers\/server\?history=30d#server-history-title"[^>]*>/,
    )?.[0];
    expect(selectedLink).toContain('aria-current="true"');
    expect(html.match(/class="flex h-full min-w-0 flex-1 items-end"/g) ?? []).toHaveLength(31);
    expect(html).toContain(locale === "ru" ? "число игроков неизвестно" : "player count unknown");
    expect(html).not.toContain("NaN");
  },
);
it("renders an empty period without fabricated chart observations", () => {
  const empty = {
    ...history,
    buckets: [],
    summary: {
      ...history.summary,
      observationCount: 0,
      knownPlayerCount: 0,
      peakPlayers: null,
      averagePlayers: null,
      latestPlayers: null,
    },
  };
  const html = renderToStaticMarkup(<ServerHistoryPanel history={empty} />);
  expect(html).toContain("selected period");
  expect(html).not.toContain("<ol");
});
it("keeps an unavailable history separate from live status", () => {
  expect(renderToStaticMarkup(<ServerHistoryPanel history={null} />)).toContain(
    "temporarily unavailable",
  );
});
