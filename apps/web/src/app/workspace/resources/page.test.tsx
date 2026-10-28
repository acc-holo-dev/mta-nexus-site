import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({
  actor: { id: "author" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  list: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.actor },
}));
vi.mock("../../../lib/services/resource-publisher-service", () => ({
  resourcePublisherService: { inventory: mocks.list },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
import Page, { metadata } from "./page";
beforeEach(() => {
  mocks.actor = { id: "author" };
  mocks.locale = "en";
  mocks.list.mockReset().mockResolvedValue({
    items: [
      {
        id: "resource",
        title: "Owned resource",
        currentVersion: "1.0.0",
        status: "pending_review",
        type: "script",
        readiness: "in_review",
        scope: "personal",
        buildCount: 1,
      },
    ],
    statusCounts: { pending_review: 41 },
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "localizes the author list and preserves status during pagination in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ status: "pending_review", page: "2" }) }),
    );
    expect(mocks.list).toHaveBeenCalledWith(
      mocks.actor,
      expect.objectContaining({ status: "pending_review", page: 2 }),
    );
    expect(html).toContain("/workspace/resources/resource");
    expect(html).toContain("status=pending_review&amp;page=3");
    expect(html).toContain(locale === "ru" ? "Мои ресурсы" : "My resources");
    expect(metadata.robots).toMatchObject({ index: false });
  },
);
it("does not query private resources when signed out", async () => {
  mocks.actor = null;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.list).not.toHaveBeenCalled();
  expect(html).toContain("/auth/login");
});
it("rejects invalid status filters before querying", async () => {
  await expect(Page({ searchParams: Promise.resolve({ status: "admin-only" }) })).rejects.toThrow(
    "NEXT_NOT_FOUND",
  );
  expect(mocks.list).not.toHaveBeenCalled();
});
