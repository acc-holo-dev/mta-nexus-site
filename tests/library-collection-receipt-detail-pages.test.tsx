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
  libraryCollectionsService: { receiptDetail: state.history },
}));

vi.mock("../apps/web/src/components/library-collection-restore", () => ({
  LibraryCollectionRestoreControls: ({
    receiptId,
    preview,
  }: {
    receiptId: string;
    preview: { itemCount: number };
  }) => <div data-restore={receiptId} data-count={preview.itemCount} />,
}));
import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/receipts/[id]/page";
import { libraryCollectionReceiptsCopy } from "../apps/web/src/lib/library-collection-receipts-i18n";
const date = "2026-10-13T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  collection = { id: "lcol_a", name: "Recorded <name>", status: "active", revision: 3 };
const report = () => ({
  schemaVersion: 1,
  generatedAt: date,
  id: "lcr_a",
  createdAt: date,
  receipt: {
    id: "lcr_a",
    requestId,
    createdAt: new Date(date),
    collection,
    command: {
      requestId,
      action: "reconcile-items",
      expectedRevision: 2,
      addProductIds: ["prd_added"],
      removeProductIds: ["prd_removed"],
    },
  },
  currentCollection: { ...collection, name: "Later", revision: 9 },
  resources: [
    {
      productId: "prd_added",
      currentTitle: "PRIVATE",
      currentAvailable: false,
      inCollection: true,
      restoreAction: "remove",
      status: "ready",
    },
    {
      productId: "prd_removed",
      currentTitle: "Accessible & title",
      currentAvailable: true,
      inCollection: false,
      restoreAction: "add",
      status: "no-access",
    },
  ],
  restoration: {
    schemaVersion: 1,
    generatedAt: date,
    collection,
    itemCount: 200,
    itemLimit: 200,
    batchLimit: 20,
    items: [],
  },
});
const screen = async (query: Record<string, string | string[] | undefined> = {}, id = "lcr_a") =>
  renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "shows immutable proof, current state and selected restoration separately in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      c = libraryCollectionReceiptsCopy(locale);
    expect(html).toContain(c.title);
    expect(html).toContain(c.note);
    expect(html).toContain("Recorded &lt;name&gt;");
    expect(html).toContain("Later");
    expect(html).toContain("Accessible &amp; title");
    expect(html).not.toContain("PRIVATE");
    expect(html).toContain('data-restore="lcr_a"');
    expect(html).toContain("/api/library/collections/receipts/lcr_a/export");
    expect(html).not.toContain("/download");
    expect(state.history).toHaveBeenCalledWith(state.actor, "lcr_a");
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${c.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("authenticates before inspecting selectors or receipt IDs", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
});
it.each([{ userId: "other" }, { page: "1" }, { q: ["a", "b"] }])(
  "rejects all ambiguous detail selectors %o before reads",
  async (query) => {
    expect(await screen(query)).toContain('role="alert"');
    expect(state.history).not.toHaveBeenCalled();
  },
);
it("renders neutral malformed proof and missing current state without restoration controls", async () => {
  state.history.mockResolvedValue({
    ...report(),
    receipt: null,
    currentCollection: null,
    restoration: null,
    resources: [],
  });
  const html = await screen();
  expect(html).toContain(libraryCollectionReceiptsCopy("en").unknown);
  expect(html).not.toContain("data-restore");
});
it("does not promise inverse state for unsupported commands and handles foreign/missing receipts neutrally", async () => {
  const value = report();
  state.history.mockResolvedValue({
    ...value,
    receipt: {
      ...value.receipt,
      command: { requestId, action: "remove", expectedRevision: 2, productId: "prd_old" },
    },
    restoration: null,
    resources: [],
  });
  expect(await screen()).toContain(libraryCollectionReceiptsCopy("en").unsupported);
  state.history.mockRejectedValue(new AppError("PRIVATE", 404, "NOT_FOUND"));
  await expect(screen({}, "lcr_foreign")).rejects.toThrow("NEXT_NOT_FOUND");
});
