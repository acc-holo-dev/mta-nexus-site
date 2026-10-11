import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en",
  detail: vi.fn(),
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { detail: state.detail },
}));
vi.mock("../apps/web/src/lib/services/library-selection-batches-service", () => ({
  librarySelectionBatchesService: { history: state.history },
}));
vi.mock("../apps/web/src/components/library-selection-batch-controls", () => ({
  LibrarySelectionBatchControls: ({ items }: { items: { productId: string }[] }) => (
    <p data-batch={items.map((i) => i.productId).join(",")}>Batch controls</p>
  ),
}));
import { LibrarySelectionBatchScreen as screen } from "../apps/web/src/components/library-selection-batch-screen";
const collection = { id: "lcol_a", name: "<Core>", status: "active", revision: 4 };
const props = { params: Promise.resolve({ id: "lcol_a" }), searchParams: Promise.resolve({}) };
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.detail.mockResolvedValue({
    collection,
    items: [{ productId: "prd_a", title: "Core", downloadable: true, hasAccess: true }],
    q: "",
    page: 1,
    totalPages: 2,
  });
  state.history.mockResolvedValue({ collection, items: [], page: 1, totalPages: 1 });
});
it.each(["ru", "en"])("renders a localized reviewed selection workflow in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await screen(props));
  expect(html).toContain(locale === "ru" ? "Версии группы ресурсов" : "Resource version batch");
  expect(html).toContain("&lt;Core&gt;");
  expect(html).toContain('data-batch="prd_a"');
  expect(html).toContain("/versions/history");
  expect(html).toContain("/versions?page=2");
});
it("prevents batch changes for an archived collection but retains history navigation", async () => {
  state.detail.mockResolvedValue({
    collection: { ...collection, status: "archived" },
    items: [],
    q: "",
    page: 1,
    totalPages: 1,
  });
  const html = renderToStaticMarkup(await screen(props));
  expect(html).toContain("Restore it before changing");
  expect(html).not.toContain("data-batch=");
  expect(html).toContain("/versions/history");
});
it("renders retained build identities without historical private titles or storage paths", async () => {
  state.history.mockResolvedValue({
    collection,
    page: 1,
    totalPages: 1,
    items: [
      {
        id: "lsbr_a",
        requestId: "f88ec3b3-b1f8-4af8-87b9-3f9f6f6cba92",
        createdAt: new Date("2026-10-12T00:00:00Z"),
        snapshot: {
          collectionRevision: 4,
          mode: "fixed",
          items: [
            {
              productId: "prd_a",
              previous: { mode: "latest", revision: 0, buildId: null },
              next: { mode: "fixed", revision: 1, buildId: "bld_a" },
            },
          ],
        },
      },
    ],
  });
  const html = renderToStaticMarkup(await screen({ ...props, history: true }));
  expect(html).toContain("bld_a");
  expect(html).toContain("prd_a");
  expect(html).toContain("/versions/history/export?page=1");
  expect(html).not.toContain("data-batch=");
  expect(html).not.toContain("storageKey");
  expect(html).not.toContain("/api/builds/");
});
it("keeps history navigation available when no operations exist", async () => {
  const html = renderToStaticMarkup(await screen({ ...props, history: true }));
  expect(html).toContain("No version selection operations");
});
it("requires authentication before either read", async () => {
  state.actor = null;
  await expect(screen(props)).rejects.toThrow("NOT_FOUND");
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
it("rejects duplicate pagination before fetching private metadata", async () => {
  await expect(
    screen({ ...props, searchParams: Promise.resolve({ page: ["1", "2"] }) }),
  ).rejects.toThrow("NOT_FOUND");
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
