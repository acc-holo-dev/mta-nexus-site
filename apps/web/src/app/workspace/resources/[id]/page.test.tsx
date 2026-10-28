import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  product: vi.fn(),
  history: vi.fn(),
  forms: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../../../lib/services/auth-service", () => ({
  authService: { getSession: async () => ({ id: "author" }) },
}));
vi.mock("../../../../lib/services/product-service", () => ({
  productService: {
    getManagedProduct: mocks.product,
    getManagedHistory: mocks.history,
    getResourceLifecycleHistory: async () => [],
  },
}));
vi.mock("../../../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../../../../components/author-resource-forms", () => ({
  AuthorResourceForms: (props: unknown) => {
    mocks.forms(props);
    return null;
  },
  RetireBuildForm: () => null,
}));
vi.mock("../../../../components/resource-lifecycle-controls", () => ({
  ResourceLifecycleControls: () => null,
}));
import Page, { metadata } from "./page";
const input = {
  params: Promise.resolve({ id: "resource" }),
  searchParams: Promise.resolve({ page: "2" }),
};
beforeEach(() => {
  mocks.locale = "en";
  mocks.forms.mockClear();
  mocks.product.mockReset().mockResolvedValue({
    id: "resource",
    title: "Owned resource",
    slug: "owned",
    description: "Description",
    tags: [],
    status: "published",
    currentVersion: "1.0.0",
    authorId: "author",
    updatedAt: new Date("2026-10-04"),
    privateField: "secret",
  });
  mocks.history.mockReset().mockResolvedValue({
    builds: [
      {
        id: "build",
        version: "1.0.0",
        status: "published",
        revision: 1,
        scanStatus: "clean",
        createdAt: new Date("2026-10-04"),
        storageKey: "private/storage/key",
        releaseNotes: "<script>unsafe()</script>",
      },
    ],
    decisions: [
      {
        id: "audit",
        buildId: "build",
        action: "build.approved",
        details: { notes: "<b>Approved safely</b>" },
      },
    ],
    page: 2,
    totalPages: 3,
  });
});
it("hides private pages and never reads history for an outsider", async () => {
  mocks.product.mockResolvedValue(null);
  await expect(Page(input)).rejects.toThrow("NOT_FOUND");
  expect(mocks.history).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "shows localized history and escaped moderation notes in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(await Page(input));
    expect(html).toContain(locale === "ru" ? "История версий" : "Version history");
    expect(html).toContain("&lt;b&gt;Approved safely&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;unsafe()");
    expect(html).not.toContain("private/storage/key");
    expect(mocks.forms.mock.calls[0][0].product).not.toHaveProperty("privateField");
    expect(mocks.forms.mock.calls[0][0].actorId).toBe("author");
    expect(mocks.forms.mock.calls[0][0].product.updatedAt).toBe("2026-10-04T00:00:00.000Z");
    expect(html).toContain("?page=3");
    expect(metadata.robots).toMatchObject({ index: false });
  },
);
