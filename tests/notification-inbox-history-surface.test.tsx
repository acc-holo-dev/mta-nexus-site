import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru", session: vi.fn(), page: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/notification-inbox-service", () => ({
  notificationInboxService: { page: state.page },
}));

import Loading from "../apps/web/src/app/notifications/loading";
import Page, { generateMetadata } from "../apps/web/src/app/notifications/page";
import { LocaleProvider } from "../apps/web/src/components/locale-context";

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
    const html = await render({ q: "needle", state: "unread", category: "content" });
    expect(html).toContain('action="/notifications"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="category"');
    expect(html).toContain('name="state"');
    expect(html).toContain("needle");
    expect(html).toContain(locale === "ru" ? "Выбрать эту страницу" : "Select this page");
    expect(html).toContain(
      locale === "ru" ? "нет подходящих уведомлений" : "No matching notifications",
    );
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
    expect(renderToStaticMarkup(await Loading())).toContain(
      locale === "ru" ? "Обновление уведомлений" : "Refreshing notifications",
    );
  },
);
it("shows sign-in when the session is absent without reading another inbox", async () => {
  state.session.mockResolvedValue(null);
  const html = await render();
  expect(html).toContain("/auth/login");
  expect(html).not.toContain("No notifications yet");
  expect(state.page).not.toHaveBeenCalled();
});
it("rejects duplicated filters before inbox queries and offers recovery", async () => {
  const html = await render({ state: ["read", "unread"] });
  expect(html).toContain("Invalid notification filters");
  expect(state.page).not.toHaveBeenCalled();
  expect(html).toContain("Latest matching notifications");
});
it.each(["session", "page"] as const)(
  "shows a recoverable failure for %s without an empty-success state",
  async (dependency) => {
    state[dependency].mockRejectedValue(new Error("PRIVATE_SQL"));
    const html = await render();
    expect(html).toContain("temporarily unavailable");
    expect(html).not.toContain("PRIVATE_SQL");
    expect(html).not.toContain("No notifications yet");
  },
);
