import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en",
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("../apps/web/src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: { history: h.history },
}));
import Page, { metadata } from "../apps/web/src/app/workspace/library/watches/history/page";
const screen = async () =>
  renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({ page: "2", source: "batch", days: "30", productId: "prd_a" }),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "usr_a" };
  h.locale = "en";
  h.history.mockResolvedValue({
    days: 30,
    source: "batch",
    productId: "prd_a",
    page: 2,
    totalPages: 3,
    items: [
      {
        id: "aud_a",
        createdAt: "2026-10-12T00:00:00.000Z",
        source: "batch",
        collection: null,
        changes: [
          {
            productId: "prd_a",
            enabled: false,
            revision: 3,
            currentTitle: "PRIVATE-TITLE",
            currentAvailable: false,
            currentWatch: { enabled: false, revision: 3 },
          },
        ],
      },
      {
        id: "aud_bad",
        createdAt: "2026-10-12T00:00:00.000Z",
        source: "unknown",
        changes: null,
        collection: null,
      },
    ],
  });
});
it.each(["en", "ru"])(
  "renders recorded state without private names or restore/download actions in %s",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain(locale === "ru" ? "История подписок" : "Release watch history");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain("prd_a");
    expect(html).toContain(locale === "ru" ? "не удалось проверить" : "could not be verified");
    expect(html).not.toContain("/versions");
    expect(html).not.toContain("/api/library/watches/disable");
    expect(html).toContain("source=batch&amp;productId=prd_a");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  },
);
it("shows a current accessible title and management link without rewriting history", async () => {
  const result = await h.history();
  result.items[0].changes[0].currentAvailable = true;
  result.items[0].changes[0].currentTitle = "<Current>";
  h.history.mockResolvedValue(result);
  const html = await screen();
  expect(html).toContain("&lt;Current&gt;");
  expect(html).toContain("/workspace/library/prd_a/versions");
});
it("requires sign-in and rejects duplicate filters before reading audit records", async () => {
  h.user = null;
  await expect(screen()).rejects.toThrow("NOT_FOUND");
  expect(h.history).not.toHaveBeenCalled();
  h.user = { id: "usr_a" };
  await expect(
    Page({ searchParams: Promise.resolve({ source: ["all", "batch"] }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(h.history).not.toHaveBeenCalled();
});
