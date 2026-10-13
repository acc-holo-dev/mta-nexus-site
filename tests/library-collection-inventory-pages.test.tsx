import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { inventory: state.history },
}));

import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/resources/page";
import { libraryCollectionInventoryCopy } from "../apps/web/src/lib/library-collection-inventory-i18n";
const date = "2026-10-13T00:00:00.000Z",
  a = { id: "lcol_a", name: "Own <active>", status: "active", revision: 4, itemCount: 2 },
  b = { id: "lcol_b", name: "Own archived", status: "archived", revision: 7, itemCount: 1 };
const report = () => ({
  schemaVersion: 1,
  generatedAt: date,
  page: 2,
  status: "active",
  filter: "shared",
  q: "%_",
  collectionId: "lcol_a",
  collections: [a, b],
  counts: { resources: 41, references: 42, available: 40, unavailable: 1, shared: 1 },
  pageSize: 20,
  total: 41,
  totalPages: 3,
  items: [
    {
      productId: "prd_a",
      title: "Accessible & title",
      available: true,
      memberships: [
        { ...a, addedAt: date },
        { ...b, addedAt: date },
      ],
    },
    {
      productId: "prd_orphan",
      title: "PRIVATE-TITLE",
      available: false,
      memberships: [{ ...a, addedAt: date }],
    },
  ],
});
const values = { page: "2", status: "active", filter: "shared", q: "%_", collectionId: "lcol_a" };
const screen = async (query: Record<string, string | string[] | undefined> = values) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "renders full memberships, masked labels, safe links and preserved filters in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      v = libraryCollectionInventoryCopy(locale);
    expect(html).toContain(v.title);
    expect(html).toContain(v.note);
    expect(html).toContain("Accessible &amp; title");
    expect(html).toContain("Own &lt;active&gt;");
    expect(html).toContain("Own archived");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain("/workspace/library/prd_a/collections");
    expect(html).toContain("/workspace/library/prd_orphan/collections");
    expect(html).toContain("/workspace/library/prd_a/versions");
    expect(html).not.toContain("/workspace/library/prd_orphan/versions");
    expect(html).not.toContain("/download");
    expect(html).toContain("/workspace/library/collections/lcol_a/compare?to=lcol_b");
    expect(html).toContain("/api/library/collections/resources/export?");
    expect(html).toContain(
      "page=1&amp;status=active&amp;filter=shared&amp;q=%25_&amp;collectionId=lcol_a",
    );
    expect(html).toContain(
      "page=3&amp;status=active&amp;filter=shared&amp;q=%25_&amp;collectionId=lcol_a",
    );
    expect(state.history).toHaveBeenCalledWith(state.actor, {
      page: 2,
      status: "active",
      filter: "shared",
      q: "%_",
      collectionId: "lcol_a",
    });
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${v.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("authenticates before query parsing or reference lookup", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
});
it.each([
  { userId: "other" },
  { page: ["1", "2"] },
  { filter: "ready" },
  { collectionId: "../private" },
  { q: "a\u0000" },
])("rejects invalid or ambiguous query %o", async (query) => {
  expect(await screen(query)).toContain('role="alert"');
  expect(state.history).not.toHaveBeenCalled();
});
it("shows empty results and masks absent/foreign collection scopes", async () => {
  state.history.mockResolvedValue({ ...report(), items: [], total: 0, page: 1, totalPages: 1 });
  expect(await screen()).toContain(libraryCollectionInventoryCopy("en").empty);
  state.history.mockRejectedValue(new AppError("PRIVATE", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NEXT_NOT_FOUND");
});
