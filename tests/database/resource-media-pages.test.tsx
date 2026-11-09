import { AppError, type ManagedResourceMedia } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  managed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/resources/prd_a/media",
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../../apps/web/src/lib/services/resource-media-service", () => ({
  resourceMediaService: { managed: state.managed },
}));

import AdminResourceMediaLoading from "../../apps/web/src/app/admin/resources/[id]/media/loading";
import { ResourceMediaEditor } from "../../apps/web/src/components/resource-media-editor";
import { ResourceMediaScreen } from "../../apps/web/src/components/resource-media-screen";
import { resourceMediaCopy } from "../../apps/web/src/lib/resource-media-i18n";

const initial: ManagedResourceMedia = {
  product: {
    id: "prd_a",
    title: "Private <script>",
    status: "draft",
    updatedAt: "2026-10-11T00:00:00Z",
  },
  items: [
    {
      id: "rmi_a",
      caption: "<script>alert(1)</script>",
      position: 0,
      width: 20,
      height: 10,
      url: "/api/resource-media/rmi_a",
    },
  ],
};
beforeEach(() => {
  state.actor = { id: "usr_a" };
  state.locale = "en";
  state.managed.mockReset().mockResolvedValue(initial);
});
it.each(["en", "ru"] as const)(
  "renders localized management and local previews in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await ResourceMediaScreen({ productId: "prd_a" }));
    expect(html).toContain(locale === "ru" ? "Галерея ресурса" : "Resource gallery");
    expect(html).toContain("/api/resource-media/rmi_a");
    expect(html).toContain('type="file"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  },
);
it("does not query private product/media data before authentication", async () => {
  state.actor = null;
  const html = renderToStaticMarkup(await ResourceMediaScreen({ productId: "prd_a" }));
  expect(html).toContain("Sign in");
  expect(state.managed).not.toHaveBeenCalled();
  expect(html).not.toContain("Private");
});
it("staff preview uses live moderation authority and excludes editing controls", async () => {
  const html = renderToStaticMarkup(await ResourceMediaScreen({ productId: "prd_a", staff: true }));
  expect(state.managed).toHaveBeenCalledWith("prd_a", "usr_a", true);
  expect(html).toContain('href="/admin/resources/prd_a"');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).toContain("View larger in gallery");
  expect(html).not.toContain('type="file"');
  expect(html).not.toContain("Make cover");
});
it("removes editing controls from a withdrawn resource", () => {
  const html = renderToStaticMarkup(
    <ResourceMediaEditor
      initial={{ ...initial, product: { ...initial.product, status: "suspended" } }}
      locale="en"
    />,
  );
  expect(html).toContain("read-only");
  expect(html).not.toContain('type="file"');
  expect(html).not.toContain("Make cover");
});
it.each(["en", "ru"] as const)(
  "renders EmptyState title and description for an empty gallery in %s",
  (locale) => {
    const copy = resourceMediaCopy(locale);
    const html = renderToStaticMarkup(
      <ResourceMediaEditor initial={{ ...initial, items: [] }} locale={locale} />,
    );
    expect(html).toContain(copy.empty);
    expect(html).toContain(copy.emptyDescription);
    expect(html).toContain("border-dashed");
    expect(html).not.toContain(`<p class="text-muted">${copy.empty}</p>`);
  },
);
it("hides missing rights with the existing not-found boundary", async () => {
  state.managed.mockRejectedValue(new AppError("Denied", 404, "NOT_FOUND"));
  await expect(ResourceMediaScreen({ productId: "prd_a" })).rejects.toThrow("NOT_FOUND");
});
it("shows an honest recovery state when gallery data fails", async () => {
  state.managed.mockRejectedValue(new Error("gallery unavailable"));
  const copy = resourceMediaCopy("en");
  const html = renderToStaticMarkup(await ResourceMediaScreen({ productId: "prd_a" }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/workspace/resources/prd_a/media"');
  expect(html).not.toContain("Private");
});
it("shows an honest staff recovery state without inventing gallery content", async () => {
  state.managed.mockRejectedValue(new Error("gallery unavailable"));
  const copy = resourceMediaCopy("en");
  const html = renderToStaticMarkup(await ResourceMediaScreen({ productId: "prd_a", staff: true }));
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain('href="/admin/resources/prd_a/media"');
  expect(html).not.toContain("Private");
});
it("clips honest loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await AdminResourceMediaLoading());
  expect(html).toContain("min-w-0 max-w-5xl");
  expect(html).toContain("overflow-x-clip");
});
