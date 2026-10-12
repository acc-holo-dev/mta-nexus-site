import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  history: vi.fn(),
  detail: vi.fn(),
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
  libraryCollectionsService: { membershipHistory: state.history, membershipReceipt: state.detail },
}));

import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/membership-history/page";
import Detail, {
  generateMetadata as detailMetadata,
} from "../apps/web/src/app/workspace/library/collections/membership-history/[id]/page";
import { LibraryMembershipHistoryScreen } from "../apps/web/src/components/library-membership-history-screen";
import { libraryMembershipHistoryCopy } from "../apps/web/src/lib/library-membership-history-i18n";
const date = "2026-10-12T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const snapshot = { id: "lcol_a", name: "Recorded <name>", status: "active", revision: 3 };
const item = () => ({
  id: "lmb_a",
  createdAt: date,
  receipt: {
    id: "lmb_a",
    requestId,
    productId: "prd_lost",
    command: {
      requestId,
      changes: [
        { collectionId: "lcol_a", expectedRevision: 2, wasInCollection: true, inCollection: false },
      ],
    },
    children: [
      {
        id: "lcr_a",
        requestId: "77ca0352-de64-4af9-9e54-7d3c56fe8d89",
        command: { action: "remove", productId: "prd_lost", expectedRevision: 2 },
        collection: snapshot,
        createdAt: new Date(date),
      },
    ],
    createdAt: new Date(date),
  },
  resource: { productId: "prd_lost", currentTitle: "PRIVATE-TITLE", currentAvailable: false },
  collections: [
    {
      collectionId: "lcol_a",
      current: { ...snapshot, name: "Later name", status: "archived", revision: 9 },
      inCollection: true,
    },
  ],
});
const report = () => ({
  schemaVersion: 1,
  generatedAt: date,
  days: 90,
  operation: "removals",
  collectionId: "lcol_a",
  productId: "prd_lost",
  page: 2,
  pageSize: 20,
  total: 41,
  totalPages: 3,
  items: [item(), { ...item(), id: "lmb_unknown", receipt: null, resource: null, collections: [] }],
});
const values = {
  page: "2",
  days: "90",
  operation: "removals",
  collectionId: "lcol_a",
  productId: "prd_lost",
};
const screen = async (query: Record<string, string | string[] | undefined> = values, id?: string) =>
  renderToStaticMarkup(
    await LibraryMembershipHistoryScreen({
      searchParams: Promise.resolve(query),
      ...(id ? { params: Promise.resolve({ id }) } : {}),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue(report());
  state.detail.mockResolvedValue({ schemaVersion: 1, generatedAt: date, item: item() });
});
it.each(["en", "ru"] as const)(
  "renders complete groups, stable links, immutable names and separately current membership in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      c = libraryMembershipHistoryCopy(locale);
    expect(html).toContain(c.title);
    expect(html).toContain(c.before);
    expect(html).toContain(c.after);
    expect(html).toContain(c.currentMembership);
    expect(html).toContain("Recorded &lt;name&gt;");
    expect(html).toContain("Later name");
    expect(html).toContain("prd_lost");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).not.toContain("/download");
    expect(html).not.toContain("/workspace/library/prd_lost/collections");
    expect(html).toContain("/workspace/library/collections/membership-history/lmb_a");
    expect(html).toContain("/api/library/collections/membership-history/export?");
    expect(html).toContain(
      "page=1&amp;days=90&amp;operation=removals&amp;collectionId=lcol_a&amp;productId=prd_lost",
    );
    expect(html).toContain(
      "page=3&amp;days=90&amp;operation=removals&amp;collectionId=lcol_a&amp;productId=prd_lost",
    );
    expect(state.history).toHaveBeenCalledWith(state.actor, {
      page: 2,
      days: 90,
      operation: "removals",
      collectionId: "lcol_a",
      productId: "prd_lost",
    });
    expect(await generateMetadata()).toEqual({
      title: `${c.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
    expect(await detailMetadata()).toEqual({
      title: `${c.detail} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
    expect(dynamic).toBe("force-dynamic");
    expect(Page({ searchParams: Promise.resolve({}) }).type).toBe(LibraryMembershipHistoryScreen);
    expect(
      Detail({ searchParams: Promise.resolve({}), params: Promise.resolve({ id: "lmb_a" }) }).type,
    ).toBe(LibraryMembershipHistoryScreen);
  },
);
it("shows stable detail after access and final current references are gone", async () => {
  state.detail.mockResolvedValue({
    schemaVersion: 1,
    generatedAt: date,
    item: {
      ...item(),
      collections: [{ collectionId: "lcol_a", current: null, inCollection: null }],
    },
  });
  const html = await screen({}, "lmb_a");
  expect(html).toContain("Recorded &lt;name&gt;");
  expect(html).not.toContain("Later name");
  expect(html).not.toContain("PRIVATE-TITLE");
  expect(state.detail).toHaveBeenCalledWith(state.actor, "lmb_a");
  expect(state.history).not.toHaveBeenCalled();
});
it("authenticates before query inspection or detail reads", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(await screen({ userId: "other" }, "lmb_a")).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it.each([
  { userId: "other" },
  { page: ["1", "2"] },
  { operation: "delete" },
  { productId: "../private" },
])("rejects ambiguous or injected list selectors %o", async (query) => {
  expect(await screen(query)).toContain('role="alert"');
  expect(state.history).not.toHaveBeenCalled();
});
it("rejects all detail selectors and maps missing/foreign detail to a missing page", async () => {
  expect(await screen({ page: "1" }, "lmb_a")).toContain('role="alert"');
  expect(state.detail).not.toHaveBeenCalled();
  state.detail.mockRejectedValue(new AppError("PRIVATE", 404, "NOT_FOUND"));
  await expect(screen({}, "lmb_foreign")).rejects.toThrow("NEXT_NOT_FOUND");
});
it("shows empty history and available resource links without granting download rights", async () => {
  state.history.mockResolvedValue({ ...report(), items: [] });
  expect(await screen()).toContain(libraryMembershipHistoryCopy("en").empty);
  state.detail.mockResolvedValue({
    schemaVersion: 1,
    generatedAt: date,
    item: {
      ...item(),
      resource: { productId: "prd_a", currentTitle: "Available & title", currentAvailable: true },
    },
  });
  const html = await screen({}, "lmb_a");
  expect(html).toContain("Available &amp; title");
  expect(html).toContain("/workspace/library/prd_a/collections");
  expect(html).not.toContain("/download");
});
