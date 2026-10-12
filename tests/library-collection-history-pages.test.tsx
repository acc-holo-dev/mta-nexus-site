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
  libraryCollectionsService: { accountHistory: state.history },
}));
import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/history/page";
import { libraryCollectionHistoryCopy } from "../apps/web/src/lib/library-collection-history-i18n";
const date = "2026-10-12T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  collection = { id: "lcol_dest", name: "Recorded & name", status: "active", revision: 2 };
const command = {
  requestId,
  action: "move-items",
  sourceCollectionId: "lcol_source",
  expectedSourceRevision: 4,
  expectedRevision: 1,
  productIds: ["prd_a", "prd_lost"],
};
const report = () => ({
  schemaVersion: 1,
  generatedAt: date,
  days: 90,
  action: "move-items",
  collectionId: "lcol_source",
  productId: "prd_a",
  page: 2,
  pageSize: 20,
  total: 41,
  totalPages: 3,
  items: [
    {
      id: "lcr_a",
      createdAt: date,
      receipt: {
        id: "lcr_a",
        requestId,
        command,
        collection,
        sourceCollection: { id: "lcol_source", revision: 5 },
        createdAt: new Date(date),
      },
      currentCollection: { ...collection, name: "Current name", status: "archived", revision: 9 },
      currentSource: { ...collection, id: "lcol_source", name: "Current source", revision: 7 },
      resources: [
        { productId: "prd_a", currentTitle: "Accessible resource", currentAvailable: true },
        { productId: "prd_lost", currentTitle: "PRIVATE-TITLE", currentAvailable: false },
      ],
    },
    {
      id: "lcr_unknown",
      createdAt: date,
      receipt: null,
      currentCollection: null,
      currentSource: null,
      resources: [],
    },
  ],
});
const values = {
  page: "2",
  days: "90",
  action: "move-items",
  collectionId: "lcol_source",
  productId: "prd_a",
};
const screen = async (query: Record<string, string | string[] | undefined> = values) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "renders immutable results separately from current collection state in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      c = libraryCollectionHistoryCopy(locale);
    expect(html).toContain(c.title);
    expect(html).toContain(c.recorded);
    expect(html).toContain("Recorded &amp; name");
    expect(html).toContain("Current name");
    expect(html).toContain("Current source");
    expect(html).toContain("Accessible resource");
    expect(html).toContain("prd_lost");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain(c.unknown);
    expect(html).not.toContain("/download");
    expect(html).toContain(
      "page=1&amp;days=90&amp;action=move-items&amp;collectionId=lcol_source&amp;productId=prd_a",
    );
    expect(html).toContain(
      "page=3&amp;days=90&amp;action=move-items&amp;collectionId=lcol_source&amp;productId=prd_a",
    );
    expect(html).toContain("/api/library/collections/history/export?");
    expect(html).toContain('href="/workspace/library/prd_a/collections"');
    expect(html).not.toContain('href="/workspace/library/prd_lost/collections"');
    expect(state.history).toHaveBeenCalledWith(state.actor, {
      page: 2,
      days: 90,
      action: "move-items",
      collectionId: "lcol_source",
      productId: "prd_a",
    });
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${c.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("authenticates before looking at filters or receipts", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
});
it.each([
  { userId: "other" },
  { page: ["1", "2"] },
  { action: "delete" },
  { productId: "../private" },
])("rejects ambiguous or injected filter %o before reads", async (query) => {
  expect(await screen(query)).toContain('role="alert"');
  expect(state.history).not.toHaveBeenCalled();
});
it("renders empty account history and maps an absent account to a missing page", async () => {
  state.history.mockResolvedValue({ ...report(), items: [], total: 0, totalPages: 1, page: 1 });
  expect(await screen()).toContain(libraryCollectionHistoryCopy("en").empty);
  state.history.mockRejectedValue(new AppError("private detail", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NEXT_NOT_FOUND");
});
