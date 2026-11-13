import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

// Vite 7 classic JSX in this host needs a global React binding for page SSR markup.
Object.assign(globalThis, { React });

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru", session: vi.fn(), page: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/notifications" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../../site/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../site/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../../site/src/lib/services/notification-inbox-service", () => ({
  notificationInboxService: { page: state.page },
}));

import Loading from "../../site/src/app/notifications/loading";
import Page, { generateMetadata } from "../../site/src/app/notifications/page";
import { LocaleProvider } from "../../site/src/components/locale-context";
import { getDictionary } from "../../site/src/lib/i18n";
import { notificationInboxCopy } from "../../site/src/lib/notification-inbox-copy";

beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "actor" });
  state.page.mockResolvedValue({ items: [], unreadCount: 0, olderCursor: null, newerCursor: null });
});
async function render(search: Record<string, string | string[]> = {}) {
  return renderToStaticMarkup(
    <LocaleProvider locale={state.locale}>
      {await Page({ searchParams: Promise.resolve(search) })}
    </LocaleProvider>,
  );
}
it.each(["en", "ru"] as const)(
  "renders private localized filters, history and loading states in %s",
  async (locale) => {
    state.locale = locale;
    const copy = notificationInboxCopy(locale);
    const html = await render({ q: "needle", state: "unread", category: "content" });
    expect(html).toContain(copy.openBetaNote);
    expect(html).toContain("min-w-0 max-w-4xl");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain(`<nav aria-label="${copy.readingState}"`);
    expect(html).not.toContain(`<nav aria-label="${copy.title}"`);
    expect(html).toContain(`aria-label="${copy.pageNavigation}"`);
    expect(html).toContain(`<section class="space-y-4" aria-label="${copy.title}"`);
    expect(html).toContain(`<search aria-label="${copy.filters}"`);
    expect(html).toContain('action="/notifications"');
    expect(html).toContain(`>${copy.reset}<`);
    expect(html).toContain('name="q"');
    expect(html).toContain("min-w-0 flex-1");
    expect(html).toContain('name="category"');
    expect(html).toContain('type="hidden"');
    expect(html).toContain('name="state"');
    expect(html).toContain('value="unread"');
    expect(html).toContain('name="period"');
    expect(html).toContain("needle");
    expect(html).toContain(locale === "ru" ? "Выбрать эту страницу" : "Select this page");
    expect(html).toContain(
      locale === "ru" ? "нет подходящих уведомлений" : "No matching notifications",
    );
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
    const loadingHtml = renderToStaticMarkup(await Loading());
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain("min-w-0 max-w-4xl");
    expect(loadingHtml).toContain("overflow-x-clip");
    expect(loadingHtml).toContain('id="notification-inbox-loading-heading"');
    expect(loadingHtml).toContain('aria-labelledby="notification-inbox-loading-heading"');
    expect(loadingHtml).toContain(`>${copy.title}<`);
    expect(loadingHtml).toContain(copy.loading);
  },
);
it("omits the inbox reset control until filters are active", async () => {
  const copy = notificationInboxCopy("en");
  const html = await render();
  expect(html).not.toContain(`>${copy.reset}<`);
});
it.each(["en", "ru"] as const)(
  "shows a human UTC period and an anchored bounded export in %s",
  async (locale) => {
    state.locale = locale;
    const from = "2026-10-06T00:00:00.123456Z",
      until = "2026-10-13T00:00:00.123456Z";
    state.page.mockResolvedValue({
      items: [],
      unreadCount: 0,
      olderCursor: null,
      newerCursor: null,
      window: { from, until },
    });
    const html = await render({ period: "7", at: until });
    expect(html).toContain(locale === "ru" ? "Закреплённый период (UTC)" : "Fixed period (UTC)");
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-accent");
    expect(html).toContain(`dateTime="${from}"`);
    expect(html).toContain('download="nexus-notification-page.json"');
    expect(html).toContain(
      `/api/notifications/inbox/export?period=7&amp;at=${encodeURIComponent(until)}`,
    );
    expect(html).toContain(locale === "ru" ? "а не только выбранные" : "not only the selection");
    expect(html).toContain('href="/notifications?period=7"');
  },
);
it.each(["en", "ru"] as const)(
  "shows localized sign-in when the session is absent without reading the inbox in %s",
  async (locale) => {
    state.locale = locale;
    state.session.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain(getDictionary(locale).workspace.signInRequired);
    expect(html).toContain('href="/auth/login?next=%2Fnotifications"');
    expect(html).toContain('href="/auth/register?next=%2Fnotifications"');
    expect(html).not.toContain('action="/notifications"');
    expect(html).not.toContain(locale === "ru" ? "Уведомлений пока нет" : "No notifications yet");
    expect(state.page).not.toHaveBeenCalled();
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("preserves notification filters in the guest login return path", async () => {
  state.session.mockResolvedValue(null);
  const html = await render({ q: "needle", state: "unread", category: "content" });
  expect(html).toContain(
    'href="/auth/login?next=%2Fnotifications%3Fq%3Dneedle%26state%3Dunread%26category%3Dcontent"',
  );
  expect(html).toContain(
    'href="/auth/register?next=%2Fnotifications%3Fq%3Dneedle%26state%3Dunread%26category%3Dcontent"',
  );
  expect(state.page).not.toHaveBeenCalled();
});
it("rejects duplicated filters before inbox queries and offers recovery", async () => {
  const html = await render({ state: ["read", "unread"] });
  expect(html).toContain("Invalid notification filters");
  expect(html).toContain('role="alert"');
  expect(html).toContain("Try again");
  expect(html).toContain('href="/notifications?state=read&amp;state=unread"');
  expect(state.page).not.toHaveBeenCalled();
  expect(html).toContain("Latest matching notifications");
});
it.each(["en", "ru"] as const)(
  "opens a notification destination from the filtered inbox in %s",
  async (locale) => {
    state.locale = locale;
    const copy = notificationInboxCopy(locale);
    state.page.mockResolvedValue({
      items: [
        {
          id: "n-open",
          title: "Release ready",
          message: "body",
          link: "/market/resource-a",
          category: "content",
          isRead: false,
          createdAt: "2026-10-13T00:00:00.000000Z",
          truncated: false,
        },
      ],
      unreadCount: 1,
      olderCursor: null,
      newerCursor: null,
    });
    const html = await render({ state: "unread" });
    expect(html).toContain("Release ready");
    expect(html).toContain('href="/market/resource-a"');
    expect(html).toContain(`>${copy.view}<`);
    expect(html).toContain(`aria-label="${copy.pageNavigation}"`);
    expect(html).toContain(`aria-label="${copy.readingState}"`);
    expect(copy.readingState).not.toBe(copy.title);
    expect(copy.pageNavigation).not.toBe(copy.title);
    expect(copy.pageNavigation).not.toBe(copy.readingState);
  },
);
it("filters the inbox from URL state and highlights the matching All/Unread/Read link", async () => {
  state.page.mockResolvedValue({
    items: [
      {
        id: "n-unread",
        title: "Only unread row",
        message: "body",
        link: null,
        category: "content",
        isRead: false,
        createdAt: "2026-10-13T00:00:00.000000Z",
        truncated: false,
      },
    ],
    unreadCount: 1,
    olderCursor: null,
    newerCursor: null,
  });
  const unread = await render({ q: "topic", state: "unread", category: "content", period: "7" });
  expect(state.page).toHaveBeenCalledWith(
    "actor",
    expect.objectContaining({
      query: "topic",
      state: "unread",
      category: "content",
      period: "7",
    }),
    "en",
  );
  expect(unread).toContain("Only unread row");
  expect(unread).toContain('href="/notifications?q=topic&amp;category=content&amp;period=7"');
  expect(unread).toContain(
    'href="/notifications?q=topic&amp;state=unread&amp;category=content&amp;period=7"',
  );
  expect(unread).toContain(
    'href="/notifications?q=topic&amp;state=read&amp;category=content&amp;period=7"',
  );
  expect(unread).toMatch(/aria-current="page"[^>]*>Unread<|>Unread<\/a[^>]*aria-current="page"/);
  expect(unread).not.toMatch(/href="\/notifications\?q=topic"[^>]*aria-current="page"/);

  state.page.mockClear();
  state.page.mockResolvedValue({
    items: [
      {
        id: "n-read",
        title: "Only read row",
        message: "body",
        link: null,
        category: "content",
        isRead: true,
        createdAt: "2026-10-13T00:00:00.000000Z",
        truncated: false,
      },
    ],
    unreadCount: 0,
    olderCursor: null,
    newerCursor: null,
  });
  const read = await render({ state: "read" });
  expect(state.page).toHaveBeenCalledWith(
    "actor",
    expect.objectContaining({ state: "read" }),
    "en",
  );
  expect(read).toContain("Only read row");
  expect(read).toMatch(/aria-current="page"[^>]*>Read<|>Read<\/a[^>]*aria-current="page"/);
  expect(read).not.toMatch(
    /href="\/notifications"(?:(?!state=)[^>])*aria-current="page"|aria-current="page"[^>]*href="\/notifications"/,
  );
});
it("drops cursor from All/Unread/Read links when the reading state changes", async () => {
  const cursor = JSON.stringify({
    id: "cursor-row",
    createdAt: "2026-10-13T00:00:00.000000Z",
    context: "a".repeat(64),
    direction: "older",
    version: 1,
  });
  const html = await render({ state: "unread", cursor, q: "needle" });
  expect(state.page).toHaveBeenCalledWith(
    "actor",
    expect.objectContaining({
      state: "unread",
      cursor: expect.objectContaining({ id: "cursor-row" }),
    }),
    "en",
  );
  expect(html).toContain('href="/notifications?q=needle"');
  expect(html).toContain('href="/notifications?q=needle&amp;state=unread"');
  expect(html).toContain('href="/notifications?q=needle&amp;state=read"');
  expect(html).not.toMatch(/href="\/notifications\?[^"]*state=(?:unread|read)[^"]*cursor=/);
  expect(html).not.toMatch(/href="\/notifications\?q=needle"[^"]*cursor=/);
});
it.each(["session", "page"] as const)(
  "shows a recoverable failure for %s without an empty-success state",
  async (dependency) => {
    state[dependency].mockRejectedValue(new Error("PRIVATE_SQL"));
    const html = await render({ state: "unread" });
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).toContain('href="/notifications?state=unread"');
    expect(html).toContain("overflow-x-clip");
    expect(html).not.toContain("PRIVATE_SQL");
    expect(html).not.toContain("No notifications yet");
  },
);
