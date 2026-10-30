import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { statisticsFixture } from "./helpers/server-statistics-fixture";

const state = vi.hoisted(() => ({ locale: "ru" as "ru" | "en", session: vi.fn(), read: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/server-statistics-service", () => ({
  serverStatisticsService: { read: state.read },
}));

import {
  ServerStatisticsLoading,
  ServerStatisticsPage,
  serverStatisticsMetadata,
} from "../apps/web/src/components/server-statistics-page";
import { ServerStatisticsPanel } from "../apps/web/src/components/server-statistics-panel";

beforeEach(() => {
  state.locale = "ru";
  state.session.mockReset().mockResolvedValue({ id: "manager", role: "admin" });
  state.read.mockReset().mockResolvedValue(statisticsFixture());
});
it.each(["ru", "en"] as const)(
  "renders actual comparison, zero-player samples and scoped export controls in %s",
  (locale) => {
    const report = statisticsFixture();
    const html = renderToStaticMarkup(
      <ServerStatisticsPanel
        report={report}
        locale={locale}
        path="/servers/server/statistics"
        managed={false}
      />,
    );
    expect(html).toContain("Server &lt;private&gt;");
    expect(html).not.toContain("Server <private>");
    expect(html).toContain(">0</td>");
    expect(html).toContain(">90 (90%)</td>");
    expect(html).toContain("before=obs_1");
    expect(html).toContain("end=2026-10-11T00%3A00%3A00.000Z");
    expect(html).toContain(locale === "ru" ? "Среднее число игроков" : "Average players");
    expect(html).toContain(locale === "ru" ? "Скачать CSV интервалов" : "Download interval CSV");
    expect(html).toContain("rounded-lg");
    expect(html).toContain("text-accent");
    expect(html).not.toContain("/api/workspace");
    expect(html).toContain(
      '<section aria-labelledby="server-statistics-observations" tabindex="0"',
    );
    expect(html).toContain('tabindex="0"');
  },
);
it("distinguishes unavailable, invalid and genuinely empty periods", async () => {
  const invalid = renderToStaticMarkup(
    await ServerStatisticsPage({
      target: { slug: "server" },
      managed: false,
      searchParams: { window: ["24h", "7d"] },
    }),
  );
  expect(invalid).toContain('role="alert"');
  expect(state.read).not.toHaveBeenCalled();
  state.read.mockRejectedValue(new Error("private SQL"));
  const failed = renderToStaticMarkup(
    await ServerStatisticsPage({ target: { slug: "server" }, managed: false, searchParams: {} }),
  );
  expect(failed).toContain("временно недоступна");
  expect(failed).not.toContain("private SQL");
  expect(failed).not.toContain("нет сохранённых наблюдений");
  const report = statisticsFixture();
  report.summary.observationCount = 0;
  report.observations = [];
  report.buckets = [];
  report.nextCursor = null;
  const empty = renderToStaticMarkup(
    <ServerStatisticsPanel
      report={report}
      locale="ru"
      path="/servers/server/statistics"
      managed={false}
    />,
  );
  expect(empty).toContain("нет сохранённых наблюдений");
  expect(empty).toContain('disabled=""');
});
it("gates private pages before reading statistics and passes only session-bound managed scope", async () => {
  state.session.mockResolvedValue(null);
  const html = renderToStaticMarkup(
    await ServerStatisticsPage({ target: { id: "server" }, managed: true, searchParams: {} }),
  );
  expect(html).toContain("Войдите");
  expect(state.read).not.toHaveBeenCalled();
  state.session.mockResolvedValue({ id: "manager", role: "admin" });
  await ServerStatisticsPage({ target: { id: "server" }, managed: true, searchParams: {} });
  expect(state.read).toHaveBeenCalledExactlyOnceWith(
    { id: "server" },
    { kind: "managed", actorId: "manager" },
    { window: "24h" },
  );
});
it("does not reveal a private or revoked listing through SSR", async () => {
  state.read.mockResolvedValue(null);
  await expect(
    ServerStatisticsPage({ target: { slug: "private" }, managed: false, searchParams: {} }),
  ).rejects.toThrow("NOT_FOUND");
});
it("offers recovery for expired pages and preserves the selected period on retry", async () => {
  state.read.mockRejectedValue(new AppError("internal", 404, "SERVER_OBSERVATION_PAGE_EXPIRED"));
  const html = renderToStaticMarkup(
    await ServerStatisticsPage({
      target: { slug: "server" },
      managed: false,
      searchParams: { window: "7d", end: "2026-10-11T00:00:00.000Z", before: "obs_1" },
    }),
  );
  expect(html).toContain("больше недоступна");
  expect(html).toContain("before=obs_1");
  expect(html).toContain('href="/servers/server/statistics?window=7d"');
});
it("localizes private metadata and loading states without embedding listing names", async () => {
  const metadata = await serverStatisticsMetadata();
  expect(metadata).toMatchObject({
    title: "Статистика сервера",
    robots: { index: false, follow: false },
  });
  expect(state.read).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(await ServerStatisticsLoading())).toContain('aria-busy="true"');
});

it("normalizes the UTC form to the same canonical period used by APIs and exports", async () => {
  await ServerStatisticsPage({
    target: { slug: "server" },
    managed: false,
    searchParams: { window: "7d", endUtc: "2026-10-01T12:34:56.123" },
  });
  expect(state.read).toHaveBeenCalledExactlyOnceWith(
    { slug: "server" },
    { kind: "public" },
    { window: "7d", end: "2026-10-01T12:34:56.123Z" },
  );
});

it("shows session infrastructure failures without presenting them as guest or empty data", async () => {
  state.session.mockRejectedValueOnce(new Error("PRIVATE_AUTH"));
  const html = renderToStaticMarkup(
    await ServerStatisticsPage({ target: { id: "server" }, managed: true, searchParams: {} }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('href="/workspace/servers/server/statistics"');
  expect(html).not.toContain("PRIVATE_AUTH");
  expect(html).not.toContain("Войдите");
  expect(state.read).not.toHaveBeenCalled();
});
