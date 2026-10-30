import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observationBrowserFixture } from "./helpers/server-observation-browser-fixture";

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
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/server-statistics-service", () => ({
  serverStatisticsService: { observations: state.read },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));

import {
  ServerObservationBrowserLoading,
  ServerObservationBrowserPage,
  serverObservationBrowserMetadata,
} from "../apps/web/src/components/server-observation-browser-page";
import { ServerObservationPeriodControls } from "../apps/web/src/components/server-observation-period-controls";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T12:00:00.000Z"));
  state.locale = "ru";
  state.session.mockResolvedValue({ id: "owner", role: "user" });
  state.read.mockResolvedValue(observationBrowserFixture());
});
afterEach(() => vi.useRealTimers());
const page = (searchParams: Record<string, string | string[] | undefined> = {}, managed = false) =>
  ServerObservationBrowserPage({
    target: managed ? { id: "server" } : { slug: "server" },
    managed,
    searchParams,
  });
it.each(["ru", "en"] as const)(
  "renders working UTC/filtered forms, preserved links, zero/unknown values and escaped text in %s",
  async (locale) => {
    state.locale = locale;
    const fixture = observationBrowserFixture();
    fixture.observations[0].observedAt = "2026-10-10T01:00:00.123456Z";
    state.read.mockResolvedValueOnce(fixture);
    const html = renderToStaticMarkup(
      await page({
        end: "2026-10-11T00:00:00.000Z",
        q: "Lua",
        players: "zero",
        password: "unknown",
        responding: "no",
      }),
    );
    expect(html).toContain('name="endUtc"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('value="2026-10-11T00:00:00.000"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="players"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="responding"');
    expect(html).toContain('action="/servers/server/observations"');
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-accent");
    expect(html).toContain("Server &lt;private&gt;");
    expect(html).toContain(">0</td>");
    expect(html).not.toContain("Server <private>");
    expect(html).toContain("q=Lua&amp;players=zero&amp;password=unknown&amp;responding=no");
    expect(html).toContain("cursor=%7B");
    expect(html).toContain("/servers/server/statistics?window=24h");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(">2026-10-10T01:00:00.123456Z</time>");
    expect(html).toContain(locale === "ru" ? "Неизвестно" : "Unknown");
    expect(state.session).not.toHaveBeenCalled();
  },
);
it("keeps duration tabs and adjacent periods anchored to the selected UTC end while clearing pagination", () => {
  const html = renderToStaticMarkup(
    <ServerObservationPeriodControls
      path="/observations"
      window="7d"
      end="2026-10-01T12:34:56.123Z"
      locale="en"
      filters={{ q: "Lua", players: "zero" }}
    />,
  );
  expect(html).toContain("window=24h&amp;end=2026-10-01T12%3A34%3A56.123Z");
  expect(html).toContain("end=2026-09-24T12%3A34%3A56.123Z");
  expect(html).toContain("end=2026-10-08T12%3A34%3A56.123Z");
  expect(html).toContain('href="/observations?window=7d&amp;q=Lua&amp;players=zero"');
  expect(html).toContain("rounded-lg");
  expect(html).toContain("bg-accent");
  expect(html).not.toContain("cursor=");
  expect(html).not.toContain("before=");
});
it("omits adjacent links beyond the current time and ninety-day bound", () => {
  const html = renderToStaticMarkup(
    <ServerObservationPeriodControls
      path="/observations"
      window="30d"
      end="2026-07-14T12:00:00.000Z"
      locale="en"
    />,
  );
  expect(html).not.toContain("Previous period</a>");
  const current = renderToStaticMarkup(
    <ServerObservationPeriodControls
      path="/observations"
      window="24h"
      end="2026-10-11T12:00:00.000Z"
      locale="en"
    />,
  );
  expect(current).not.toContain("Next period</a>");
});
it("requires session identity for managed queries and distinguishes session failures", async () => {
  state.session.mockResolvedValueOnce(null);
  expect(renderToStaticMarkup(await page({}, true))).toContain("Войдите");
  expect(state.read).not.toHaveBeenCalled();
  state.session.mockRejectedValueOnce(new Error("PRIVATE_AUTH"));
  const failed = renderToStaticMarkup(await page({}, true));
  expect(failed).toContain('role="alert"');
  expect(failed).not.toContain("PRIVATE_AUTH");
  expect(state.read).not.toHaveBeenCalled();
  await page({}, true);
  expect(state.read).toHaveBeenCalledWith(
    { id: "server" },
    { kind: "managed", actorId: "owner" },
    expect.any(Object),
  );
});
it("keeps invalid, unavailable, revoked and genuinely empty results distinct", async () => {
  expect(renderToStaticMarkup(await page({ q: ["a", "b"] }))).toContain("Некорректные");
  expect(state.read).not.toHaveBeenCalled();
  state.read.mockRejectedValueOnce(new AppError("PRIVATE_DB", 400, "INVALID_CURSOR"));
  const failed = renderToStaticMarkup(await page({ q: "Lua", end: "2026-10-11T00:00:00.000Z" }));
  expect(failed).toContain("q=Lua");
  expect(failed).not.toContain("PRIVATE_DB");
  const empty = observationBrowserFixture();
  empty.observations = [];
  empty.nextCursor = null;
  state.read.mockResolvedValueOnce(empty);
  const html = renderToStaticMarkup(await page());
  expect(html).toContain("нет наблюдений");
  expect(html).toContain('disabled=""');
  state.read.mockResolvedValueOnce(null);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
it("offers both newer/older filtered links, private export controls and the existing endpoint-history limitation", async () => {
  const fixture = observationBrowserFixture();
  fixture.previousCursor = fixture.nextCursor?.replace('"older"', '"newer"') ?? null;
  fixture.server.visibility = "private";
  fixture.server.endpointRevision = 2;
  fixture.collectionEligible = false;
  state.read.mockResolvedValueOnce(fixture);
  const html = renderToStaticMarkup(await page({ q: "mode" }, true));
  expect(html).toContain("Более новые наблюдения");
  expect(html).toContain("Более ранние наблюдения");
  expect(html).toContain("версии адреса");
  expect(html).toContain("исключена из сбора");
});
it("keeps private metadata, loading and errors localized without target identity", async () => {
  expect(await serverObservationBrowserMetadata()).toMatchObject({
    title: "Поиск по наблюдениям",
    robots: { index: false, follow: false },
  });
  expect(renderToStaticMarkup(await ServerObservationBrowserLoading())).toContain(
    'aria-busy="true"',
  );
  expect(state.read).not.toHaveBeenCalled();
});
