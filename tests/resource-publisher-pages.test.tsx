import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
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
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-publisher-service", () => ({
  resourcePublisherService: { inventory: state.inventory, history: state.history },
}));
import InventoryPage from "../apps/web/src/app/workspace/resources/page";
import HistoryPage from "../apps/web/src/app/workspace/resources/[id]/history/page";
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
it("checks authentication before parsing private queries or querying repositories", async () => {
  state.actor = null;
  expect(
    renderToStaticMarkup(
      await InventoryPage({ searchParams: Promise.resolve({ ownerId: "other" }) }),
    ),
  ).toContain("/auth/login");
  await expect(HistoryPage(context)).rejects.toThrow("NEXT_NOT_FOUND");
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
