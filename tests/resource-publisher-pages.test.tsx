import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "developer" } as { id: string; role: "developer" } | null,
  locale: "en" as "en" | "ru",
  inventory: vi.fn(),
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/workspace/resources/prd_a/history",
}));
vi.mock("../site/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../site/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../site/src/lib/services/resource-publisher-service", () => ({
  resourcePublisherService: { inventory: state.inventory, history: state.history },
}));

import HistoryPage from "../site/src/app/workspace/resources/[id]/history/page";
import InventoryPage from "../site/src/app/workspace/resources/page";
import { getDictionary } from "../site/src/lib/i18n";
import { getResourcePublisherCopy } from "../site/src/lib/resource-publisher-i18n";

const context = {
  params: Promise.resolve({ id: "prd_a" }),
  searchParams: Promise.resolve({ kind: "changes", page: "2" }),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "developer" };
  state.locale = "en";
  state.inventory.mockResolvedValue({
    items: [
      {
        id: "prd_a",
        title: "<Private>",
        status: "draft",
        type: "script",
        readiness: "ready",
        metadataReviewRequired: true,
        scope: "organization",
        currentVersion: "1.0.0",
        buildCount: 2,
        secret: "DO_NOT_RENDER",
      },
    ],
    statusCounts: { draft: 41 },
    page: 2,
    totalPages: 3,
  });
  state.history.mockResolvedValue({
    product: { id: "prd_a", title: "<Private>", authorId: "DO_NOT_RENDER" },
    items: [
      {
        id: "aud_a",
        action: "product.details_updated",
        status: "draft",
        metadataReviewRequired: true,
        reason: "",
        createdAt: new Date("2026-10-11T00:00:00Z"),
        actorId: "DO_NOT_RENDER",
      },
    ],
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "keeps publisher criteria and renders actual readiness without private fields (%s)",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await InventoryPage({
        searchParams: Promise.resolve({
          status: "draft",
          type: "script",
          scope: "organization",
          readiness: "ready",
          q: "private",
          sort: "title",
          page: "2",
        }),
      }),
    );
    expect(html).toContain("&lt;Private&gt;");
    expect(html).not.toContain("DO_NOT_RENDER");
    expect(html).toContain("scope=organization");
    expect(html).toContain("readiness=ready");
    expect(html).toContain("q=private");
    expect(html).toContain("page=3");
    expect(html).toContain(
      locale === "ru" ? "Нужна повторная проверка карточки" : "Editorial review required",
    );
    expect(html).toContain(
      locale === "ru" ? "Чистая версия готова к отправке" : "Ready to submit a clean version",
    );
    expect(html).toContain(
      locale === "ru" ? 'aria-label="Мои ресурсы"' : 'aria-label="My resources"',
    );
  },
);
it.each(["en", "ru"] as const)(
  "renders a private editorial history and preserves event kind (%s)",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await HistoryPage(context));
    expect(state.history).toHaveBeenCalledWith(state.actor, "prd_a", { kind: "changes", page: 2 });
    expect(html).toContain("kind=changes&amp;page=3");
    expect(html).not.toContain("DO_NOT_RENDER");
    expect(html).toContain(
      locale === "ru" ? "Изменения ресурса и публикация" : "Resource changes and publication",
    );
  },
);
it.each([
  {
    locale: "en" as const,
    statusCounts: {},
    searchParams: {},
    expectText: "You have not created any resources yet.",
  },
  {
    locale: "ru" as const,
    statusCounts: {},
    searchParams: {},
    expectText: "Вы ещё не создали ни одного ресурса.",
  },
  {
    locale: "en" as const,
    statusCounts: { draft: 2, published: 1 },
    searchParams: { status: "archived" },
    expectText: "No resources match these filters.",
  },
  {
    locale: "ru" as const,
    statusCounts: { draft: 2 },
    searchParams: { q: "missing" },
    expectText: "Нет ресурсов по выбранным фильтрам.",
  },
])(
  "shows an honest inventory empty state (%s)",
  async ({ locale, statusCounts, searchParams, expectText }) => {
    state.locale = locale;
    state.inventory.mockResolvedValue({
      items: [],
      statusCounts,
      page: 1,
      totalPages: 1,
    });
    const html = renderToStaticMarkup(
      await InventoryPage({ searchParams: Promise.resolve(searchParams) }),
    );
    expect(html).toContain(expectText);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-11");
    if (Object.keys(statusCounts).length === 0 && Object.keys(searchParams).length === 0) {
      expect(html).toContain("/workspace/resources/new");
      expect(html).toContain(getDictionary(locale).authorResources.emptyHint);
    } else {
      expect(html).toContain(getDictionary(locale).authorResources.emptyFilterHint);
      expect(html).toContain("/workspace/resources");
    }
  },
);
it("shows an honest recovery state when publisher inventory fails", async () => {
  state.inventory.mockRejectedValue(new Error("inventory unavailable"));
  const copy = getDictionary("en").authorResources;
  const html = renderToStaticMarkup(
    await InventoryPage({ searchParams: Promise.resolve({ status: "draft", page: "2" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(copy.loadUnavailableHint);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("status=draft");
  expect(html).not.toContain("DO_NOT_RENDER");
});
it.each(["en", "ru"] as const)(
  "distinguishes lifetime-empty resource history from kind-filtered empty results in %s",
  async (locale) => {
    state.locale = locale;
    const copy = getResourcePublisherCopy(locale);
    state.history.mockResolvedValue({
      product: { id: "prd_a", title: "<Private>", authorId: "DO_NOT_RENDER" },
      items: [],
      page: 1,
      totalPages: 1,
    });
    const lifetime = renderToStaticMarkup(
      await HistoryPage({
        params: Promise.resolve({ id: "prd_a" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(lifetime).toContain(copy.empty);
    expect(lifetime).not.toContain(copy.emptyFiltered);
    expect(lifetime).not.toContain(copy.reset);
    const filtered = renderToStaticMarkup(
      await HistoryPage({
        params: Promise.resolve({ id: "prd_a" }),
        searchParams: Promise.resolve({ kind: "changes" }),
      }),
    );
    expect(filtered).toContain(copy.emptyFiltered);
    expect(filtered).not.toContain(`>${copy.empty}<`);
    expect(filtered).toContain(copy.reset);
    expect(filtered).toContain("focus-visible:outline-[var(--nexus-accent)]");
  },
);
it("checks authentication before parsing private queries or querying repositories", async () => {
  state.actor = null;
  expect(
    renderToStaticMarkup(
      await InventoryPage({ searchParams: Promise.resolve({ ownerId: "other" }) }),
    ),
  ).toContain("/auth/login?next=");
  const historyHtml = renderToStaticMarkup(await HistoryPage(context));
  expect(historyHtml).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fresources%2Fprd_a%2Fhistory%3Fkind%3Dchanges%26page%3D2"',
  );
  expect(state.inventory).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
it("rejects ambiguous selectors and hides lost authority", async () => {
  await expect(
    InventoryPage({ searchParams: Promise.resolve({ scope: ["personal", "organization"] }) }),
  ).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.inventory).not.toHaveBeenCalled();
  state.history.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  await expect(HistoryPage(context)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("shows an honest recovery state when editorial history fails", async () => {
  state.history.mockRejectedValue(new Error("history unavailable"));
  const copy = getResourcePublisherCopy("en");
  const html = renderToStaticMarkup(await HistoryPage(context));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("kind=changes");
  expect(html).not.toContain("DO_NOT_RENDER");
});
