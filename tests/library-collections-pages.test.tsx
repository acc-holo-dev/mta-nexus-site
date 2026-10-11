import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "ru" | "en",
  page: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { page: state.page, detail: state.detail, history: state.history },
}));
vi.mock("../apps/web/src/components/library-collection-command", () => ({
  LibraryCollectionCommandForm: ({
    action = "create",
    productId,
  }: {
    action?: string;
    productId?: string;
  }) => (
    <button type="button" data-action={action} data-product={productId}>
      {action}
    </button>
  ),
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId?: string }) => (
    <button type="button" data-download={productId} data-build={buildId}>
      Download
    </button>
  ),
}));

import { LibraryCollectionsScreen } from "../apps/web/src/components/library-collections-screen";

const date = new Date("2026-10-11T00:00:00Z"),
  collection = {
    id: "lcol_a",
    name: "Core & maps",
    status: "active" as const,
    revision: 4,
    createdAt: date,
    updatedAt: date,
  },
  bounds = { page: 1, totalPages: 2, total: 21, pageSize: 20, offset: 0 };
const screen = async (
  view: "list" | "detail" | "add" | "history" = "list",
  values: Record<string, string> = {},
) =>
  renderToStaticMarkup(
    await LibraryCollectionsScreen({
      view,
      searchParams: Promise.resolve(values),
      params: Promise.resolve({ id: "lcol_a" }),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.page.mockResolvedValue({
    ...bounds,
    items: [{ ...collection, itemCount: 3 }],
    status: "active",
    limit: 30,
  });
  state.detail.mockResolvedValue({
    ...bounds,
    collection,
    items: [
      {
        productId: "prd_a",
        addedAt: date,
        title: "Safe script",
        slug: "safe-script",
        version: "1.0.0",
        buildId: "bld_fixed",
        downloadable: true,
        hasAccess: true,
        inCollection: true,
      },
      {
        productId: "prd_hidden",
        addedAt: date,
        title: null,
        slug: null,
        version: null,
        buildId: null,
        downloadable: false,
        hasAccess: false,
        inCollection: true,
      },
    ],
    ready: 1,
    q: "",
    candidates: false,
    itemLimit: 200,
  });
  state.history.mockResolvedValue({
    ...bounds,
    collection,
    items: [
      {
        id: "lcr_a",
        requestId: "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
        command: { action: "remove", productId: "prd_a" },
        collection: { ...collection, revision: 3 },
        createdAt: date,
      },
    ],
  });
});
it("authenticates all views before repository access", async () => {
  state.actor = null;
  for (const view of ["list", "detail", "add", "history"] as const)
    expect(await screen(view)).toContain("Sign in to manage");
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "renders creation, private history navigation and bounded listing in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen();
    expect(html).toContain('data-action="create"');
    expect(html).toContain("Core &amp; maps");
    expect(html).toContain("/workspace/library/collections/lcol_a");
    expect(html).toContain("status=active&amp;page=2");
    expect(html).toContain(locale === "ru" ? "Мои коллекции ресурсов" : "My resource collections");
  },
);
it("downloads exactly the pinned safe version and hides lost-access navigation", async () => {
  const html = await screen("detail");
  expect(html).toContain('data-build="bld_fixed"');
  expect(html).not.toContain('data-download="prd_hidden"');
  expect(html).not.toContain("/workspace/library/prd_hidden/versions");
  expect(html).toContain('data-product="prd_hidden"');
  expect(html).toContain("Resource unavailable");
  expect(html).toContain("/lcol_a/history");
});
it("keeps archive contents readable but only permits restore", async () => {
  const result = await state.detail();
  state.detail.mockResolvedValue({ ...result, collection: { ...collection, status: "archived" } });
  const html = await screen("detail");
  expect(html).toContain('data-action="restore"');
  expect(html).not.toContain('data-action="rename"');
  expect(html).not.toContain('data-action="remove"');
  expect(html).not.toContain("/lcol_a/add");
  expect(html).toContain('data-download="prd_a"');
});
it("does not offer duplicate addition and preserves literal search in pagination", async () => {
  const result = await state.detail();
  state.detail.mockResolvedValue({
    ...result,
    q: "core & maps",
    items: [
      { ...result.items[0], inCollection: true },
      { ...result.items[1], productId: "prd_new", inCollection: false, hasAccess: true },
    ],
  });
  const html = await screen("add", { q: "core & maps" });
  expect(html).toContain("Already in collection");
  expect(html).toContain('data-action="add" data-product="prd_new"');
  expect(html).toContain("page=2&amp;q=core+%26+maps");
});
it("shows immutable command history and current private JSON link", async () => {
  const html = await screen("history");
  expect(html).toContain("2026-10-11T00:00:00.000Z");
  expect(html).toContain("Revision 3");
  expect(html).toContain("/api/library/collections/lcol_a/history?page=1");
});
it("rejects spoofed account controls before service invocation", async () => {
  const html = await screen("list", { userId: "other" });
  expect(html).toContain("Check the name");
  expect(state.page).not.toHaveBeenCalled();
});
it("offers bulk cleanup for lost-access references and no batch mutations in archives", async () => {
  const html = await screen("detail");
  expect(html).toContain("Remove selected references");
  expect(html).toContain("Select up to 20 resources");
  expect(html).toContain("prd_hidden</code>");
  const result = await state.detail();
  state.detail.mockResolvedValue({ ...result, collection: { ...collection, status: "archived" } });
  expect(await screen("detail")).not.toContain("Remove selected references");
});
it("renders all recorded batch IDs without retrieving current private resource metadata", async () => {
  const result = await state.history();
  state.history.mockResolvedValue({
    ...result,
    items: [
      {
        ...result.items[0],
        command: { action: "remove-many", productIds: ["prd_old_a", "prd_old_b"] },
      },
    ],
  });
  const html = await screen("history");
  expect(html).toContain("Remove selected references");
  expect(html).toContain("prd_old_a");
  expect(html).toContain("prd_old_b");
  expect(state.detail).not.toHaveBeenCalled();
});
