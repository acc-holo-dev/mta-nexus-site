import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "developer" } as null | { id: string; role: "developer" },
  locale: "en" as "en" | "ru",
  product: vi.fn(),
  managed: vi.fn(),
  candidates: vi.fn(),
  resolution: vi.fn(),
  variantForm: vi.fn(),
  compatibilityForm: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { getManagedProduct: state.product, getDependencyResolution: state.resolution },
}));
vi.mock("../apps/web/src/lib/services/resource-management-service", () => ({
  resourceManagementService: {
    managedVariants: state.managed,
    variantCandidates: state.candidates,
  },
}));
vi.mock("../apps/web/src/components/resource-variants-form", () => ({
  ResourceVariantsForm: (props: unknown) => {
    state.variantForm(props);
    return null;
  },
}));
vi.mock("../apps/web/src/components/resource-compatibility-form", () => ({
  ResourceCompatibilityForm: (props: unknown) => {
    state.compatibilityForm(props);
    return null;
  },
}));

import CompatibilityPage from "../apps/web/src/app/workspace/resources/[id]/compatibility/page";
import VariantsPage, { metadata } from "../apps/web/src/app/workspace/resources/[id]/variants/page";
import { ResourceVariantChoices } from "../apps/web/src/components/resource-variant-choices";

const context = { params: Promise.resolve({ id: "prd_a" }) },
  revision = "2026-10-10T00:00:00.000Z";
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "developer" };
  state.locale = "en";
  state.product
    .mockReset()
    .mockResolvedValue({
      id: "prd_a",
      title: "<script>Private title</script>",
      slug: "resource-a",
      status: "published",
      updatedAt: new Date(revision),
      compatibility: { dependencies: [] },
      privateField: "must-not-serialize",
      authorId: "usr_a",
    });
  state.managed.mockReset().mockResolvedValue({ anchorProductId: "prd_a", group: null });
  state.candidates.mockReset().mockResolvedValue({ candidates: [], page: 1, hasMore: false });
  state.resolution
    .mockReset()
    .mockResolvedValue({
      dependencies: [],
      declaredCount: 0,
      availableCount: 0,
      unresolvedCount: 0,
      selfReferenceCount: 0,
    });
});
it("does not discover private groups or requirements for a guest", async () => {
  state.user = null;
  for (const Page of [VariantsPage, CompatibilityPage])
    expect(renderToStaticMarkup(await Page(context))).toContain('href="/auth/login"');
  expect(state.product).not.toHaveBeenCalled();
  expect(state.managed).not.toHaveBeenCalled();
  expect(state.resolution).not.toHaveBeenCalled();
});
it("denies outsiders before reading group membership or dependency context", async () => {
  state.product.mockResolvedValue(null);
  for (const Page of [VariantsPage, CompatibilityPage])
    await expect(Page(context)).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.managed).not.toHaveBeenCalled();
  expect(state.candidates).not.toHaveBeenCalled();
  expect(state.resolution).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "renders localized private controls with narrow product props (%s)",
  async (locale) => {
    state.locale = locale;
    const variantHtml = renderToStaticMarkup(await VariantsPage(context)),
      compatibilityHtml = renderToStaticMarkup(await CompatibilityPage(context));
    expect(variantHtml).toContain(locale === "ru" ? "Варианты ресурса" : "Resource variants");
    expect(compatibilityHtml).toContain(
      locale === "ru" ? "Совместимость и зависимости" : "Compatibility and dependencies",
    );
    expect(variantHtml).toContain("&lt;script&gt;Private title&lt;/script&gt;");
    expect(state.variantForm.mock.calls[0][0].product).toEqual({
      id: "prd_a",
      title: "<script>Private title</script>",
    });
    expect(state.compatibilityForm.mock.calls[0][0].product).toEqual({
      id: "prd_a",
      updatedAt: revision,
      compatibility: { dependencies: [] },
      suspended: false,
    });
    expect(variantHtml + compatibilityHtml).not.toContain("must-not-serialize");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  },
);
it("routes member management to the authorized anchor and skips candidates", async () => {
  state.managed.mockResolvedValue({
    anchorProductId: "prd_anchor",
    group: { id: "vgrp_a", revision: 2, title: "Editions", variants: [] },
  });
  expect(renderToStaticMarkup(await VariantsPage(context))).toContain(
    'href="/workspace/resources/prd_anchor/variants"',
  );
  expect(state.variantForm).not.toHaveBeenCalled();
  expect(state.candidates).not.toHaveBeenCalled();
});
it("marks suspended requirements as blocked", async () => {
  state.product.mockResolvedValue({
    id: "prd_a",
    title: "Suspended",
    status: "suspended",
    updatedAt: new Date(revision),
    compatibility: { dependencies: [] },
    privateField: "secret",
  });
  renderToStaticMarkup(await CompatibilityPage(context));
  expect(state.compatibilityForm.mock.calls[0][0].product.suspended).toBe(true);
  expect(state.compatibilityForm.mock.calls[0][0].product).not.toHaveProperty("privateField");
});
it.each(["en", "ru"] as const)(
  "renders escaped variant links and independent acquisition (%s)",
  (locale) => {
    const html = renderToStaticMarkup(
      <ResourceVariantChoices
        locale={locale}
        productId="prd_a"
        group={{
          title: "<b>Editions</b>",
          variants: [
            {
              productId: "prd_a",
              label: "Base",
              title: "Resource",
              slug: "resource-a",
              currentVersion: "1.0.0",
            },
            {
              productId: "prd_b",
              label: "<script>Lite</script>",
              title: "Resource Lite",
              slug: "resource-b",
              currentVersion: "2.0.0",
            },
          ],
        }}
      />,
    );
    expect(html).toContain('href="/market/resource-b"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("&lt;b&gt;Editions&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;Lite&lt;/script&gt;");
    expect(html).toContain(
      locale === "ru"
        ? "Каждый вариант добавляется в библиотеку отдельно"
        : "Each variant is added to your library separately",
    );
    expect(html).not.toContain("/download");
  },
);
it("does not display an empty chooser", () => {
  for (const group of [null, { title: "Editions", variants: [] }])
    expect(
      renderToStaticMarkup(<ResourceVariantChoices locale="en" productId="prd_a" group={group} />),
    ).toBe("");
});
