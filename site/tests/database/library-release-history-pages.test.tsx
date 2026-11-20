vi.mock("server-only", () => ({}));

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
  usePathname: () => "/workspace/library/version-history",
}));
vi.mock("../../src/lib/i18n/server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => h.actor },
}));
vi.mock("../../src/lib/services/resources/resource-release-control-service", () => ({
  libraryReleaseService: { history: h.history },
}));

import { libraryReleaseHistoryCopy } from "../../src/features/library/library-release-history-i18n";
import { LibraryReleaseHistoryScreen } from "../../src/features/library/release-history-server";
import { getDictionary } from "../../src/lib/i18n";
import { authService } from "../../src/lib/services/accounts/auth-service";

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
  const html = await screen();
  expect(html).toContain(getDictionary("en").workspace.signInRequired);
  expect(html).toContain("/auth/login?next=");
  expect(html).toContain("%2Fworkspace%2Flibrary%2Fversion-history");
  expect(h.history).not.toHaveBeenCalled();
});
it("shows an honest recovery state when version history fails to load", async () => {
  h.history.mockRejectedValueOnce(new Error("history unavailable"));
  const copy = (
    await import("../../src/features/library/library-release-history-i18n")
  ).libraryReleaseHistoryCopy("en");
  const html = await screen();
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain(`>${copy.title}</h1>`);
  expect(html).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(html).toContain("page=1&amp;days=30");
  expect(html).not.toContain("history unavailable");
});
it.each(["en", "ru"] as const)(
  "retains version history filters after session failure in %s",
  async (locale) => {
    h.locale = locale;
    vi.spyOn(authService, "getSession").mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
    const html = await screen({ page: "2", days: "90", productId: "prd_a" });
    const copy = libraryReleaseHistoryCopy(locale);
    expect(html).toContain(`>${copy.title}</h1>`);
    expect(html).toContain(copy.loadUnavailable);
    expect(html).toContain(
      'href="/workspace/library/version-history?page=2&amp;days=90&amp;productId=prd_a"',
    );
    expect(html).not.toContain("/auth/login");
    expect(html).not.toContain("PRIVATE_SESSION");
    expect(h.history).not.toHaveBeenCalled();
  },
);
