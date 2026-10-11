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
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-media-service", () => ({
  resourceMediaService: { managed: state.managed },
}));

import { ResourceMediaEditor } from "../apps/web/src/components/resource-media-editor";
import { ResourceMediaScreen } from "../apps/web/src/components/resource-media-screen";

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
it("hides missing rights with the existing not-found boundary", async () => {
  state.managed.mockRejectedValue(new AppError("Denied", 404, "NOT_FOUND"));
  await expect(ResourceMediaScreen({ productId: "prd_a" })).rejects.toThrow("NOT_FOUND");
});
