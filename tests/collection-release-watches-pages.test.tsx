import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("../apps/web/src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: { collectionPage: h.page },
}));
import Page, {
  metadata,
} from "../apps/web/src/app/workspace/library/collections/[id]/watches/page";
const screen = async () =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "lcol_a" }),
      searchParams: Promise.resolve({ filter: "disabled", page: "2", query: "Core" }),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "usr_a" };
  h.locale = "en";
  h.page.mockResolvedValue({
    collection: { id: "lcol_a", name: "<Core>", status: "active", revision: 3 },
    activeWatchCount: 4,
    items: [
      { productId: "prd_a", enabled: false, revision: 0, available: true, title: "Root" },
      { productId: "prd_b", enabled: false, revision: 2, available: false, title: "PRIVATE-TITLE" },
    ],
    counts: { all: 22, enabled: 0, disabled: 22, unavailable: 1 },
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "offers explicit future-release enrollment while masking unavailable titles in %s",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain("&lt;Core&gt;");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain(
      locale === "ru" ? "Включить выбранные подписки" : "Enable selected watches",
    );
    expect(html).toContain("4/100");
    expect(html).toContain("query=Core");
    expect(html).toContain("/workspace/library/watches");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  },
);
it("leaves archived collections inspectable without enrollment controls", async () => {
  const result = await h.page();
  h.page.mockResolvedValue({ ...result, collection: { ...result.collection, status: "archived" } });
  const html = await screen();
  expect(html).toContain("Restore it before enrolling");
  expect(html).not.toContain("Enable selected watches");
});
it("requires sign-in before reading a private collection", async () => {
  h.user = null;
  await expect(screen()).rejects.toThrow("NOT_FOUND");
  expect(h.page).not.toHaveBeenCalled();
});
