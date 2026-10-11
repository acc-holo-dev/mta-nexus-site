import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
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
  authService: { getSession: async () => h.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { history: h.history },
}));
import { LibraryReleaseHistoryScreen } from "../apps/web/src/components/library-release-history-screen";
const result = () => ({
  generatedAt: "2026-10-12T00:00:00.000Z",
  days: 90,
  page: 2,
  totalPages: 3,
  productId: "prd_a",
  items: [
    {
      id: "aud_a",
      productId: "prd_a",
      createdAt: new Date("2026-10-12T00:00:00Z"),
      currentTitle: "Current & title",
      hasCurrentAccess: true,
      buildVersion: "1.0.0",
      selection: { mode: "fixed", buildId: "bld_a", revision: 2 },
      source: "batch",
    },
    {
      id: "aud_b",
      productId: "prd_lost",
      createdAt: new Date("2026-10-11T00:00:00Z"),
      currentTitle: null,
      hasCurrentAccess: false,
      buildVersion: null,
      selection: { mode: "latest", buildId: null, revision: 3 },
      source: "individual",
    },
    {
      id: "aud_c",
      productId: "prd_legacy",
      createdAt: new Date("2026-10-10T00:00:00Z"),
      currentTitle: null,
      hasCurrentAccess: false,
      buildVersion: null,
      selection: null,
      source: "unknown",
    },
  ],
});
const screen = async (raw: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(await LibraryReleaseHistoryScreen({ searchParams: Promise.resolve(raw) }));
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { id: "usr_a", role: "user" };
  h.locale = "en";
  h.history.mockResolvedValue(result());
});
it.each(["en", "ru"])(
  "renders recorded personal choices and current-label boundaries in %s",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain(
      locale === "ru" ? "Моя история выбора версий" : "My version selection history",
    );
    expect(html).toContain("bld_a");
    expect(html).toContain("1.0.0");
    expect(html).toContain("Current &amp; title");
    expect(html).toContain("prd_lost");
    expect(html).not.toContain("/prd_lost/versions");
    expect(html).toContain("/prd_a/versions");
    expect(html).not.toContain("data-download");
  },
);
it("retains period/resource scope in pagination and the export and clears only resource scope", async () => {
  const html = await screen();
  expect(html).toContain("page=3&amp;days=90&amp;productId=prd_a");
  expect(html).toContain('/version-history?days=90"');
  expect(html).toContain("/history/export?page=2&amp;days=90&amp;productId=prd_a");
});
it("rejects ambiguous scope and requires authentication before history calls", async () => {
  await expect(screen({ userId: "other" })).rejects.toThrow("NOT_FOUND");
  await expect(screen({ days: ["7", "30"] })).rejects.toThrow("NOT_FOUND");
  expect(h.history).not.toHaveBeenCalled();
  h.actor = null;
  await expect(screen()).rejects.toThrow("NOT_FOUND");
});
