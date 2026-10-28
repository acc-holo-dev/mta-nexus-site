import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; role: "user" | "admin" },
  locale: "en" as "en" | "ru",
  product: {
    id: "prd_release",
    slug: "safe-release",
    title: "Safe Resource",
    status: "published",
    price: 0,
  } as null | Record<string, unknown>,
  manager: false,
  entitled: false,
  history: vi.fn(),
  getProduct: vi.fn(),
  canManage: vi.fn(),
  checkRight: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
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
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("@nexus/db", () => ({
  buildRepository: { pagePublishedReleases: state.history },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    getProductBySlug: state.getProduct,
    canManageProduct: state.canManage,
  },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { checkEntitlement: state.checkRight },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../apps/web/src/components/resource-download-button", async () => {
  const React = await import("react");
  return {
    ResourceDownloadButton: ({
      productId,
      version,
      buildId,
    }: {
      productId: string;
      version: string;
      buildId: string;
    }) =>
      React.createElement(
        "button",
        {
          "data-resource": productId,
          "data-version": version,
          "data-build": buildId,
        },
        "Pinned download",
      ),
  };
});

import ReleasePage, { metadata } from "../apps/web/src/app/market/[slug]/versions/page";

const release = {
  id: "bld_clean_1",
  version: "1.2.0",
  releaseNotes: "New commands\nFix bugs",
  status: "published",
  storageKey: "PRIVATE_STORAGE_PATH",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 12345,
  fileName: "private-server-file.zip",
  mimeType: "application/zip",
  mtaVersionTarget: "1.6.0",
  scanStatus: "clean",
  scanner: "clamav",
  scannedAt: new Date("2026-10-09T10:00:00Z"),
  isSigned: false,
  createdAt: new Date("2026-10-09T12:00:00Z"),
};
function page(input: string | string[] = "1") {
  return ReleasePage({
    params: Promise.resolve({ slug: "safe-release" }),
    searchParams: Promise.resolve({ page: input }),
  });
}

describe("public safely published version archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    state.locale = "en";
    state.product = {
      id: "prd_release",
      slug: "safe-release",
      title: "Safe Resource",
      status: "published",
      price: 0,
    };
    state.manager = false;
    state.entitled = false;
    state.getProduct.mockImplementation(async () => state.product);
    state.canManage.mockImplementation(async () => state.manager);
    state.checkRight.mockImplementation(async () => state.entitled);
    state.history.mockResolvedValue({
      releases: [release],
      page: 1,
      pageSize: 12,
      totalPages: 1,
      total: 1,
    });
  });

  it.each(["en", "ru"] as const)("shows public version metadata safely in %s", async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await page());
    expect(state.getProduct).toHaveBeenCalledWith("safe-release");
    expect(state.history).toHaveBeenCalledWith("prd_release", 1);
    expect(html).toContain("Safe Resource");
    expect(html).toContain("1.2.0");
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("New commands");
    expect(html).not.toContain("PRIVATE_STORAGE_PATH");
    expect(html).not.toContain("private-server-file.zip");
    expect(html).not.toContain('data-build="bld_clean_1"');
    expect(html).toContain(locale === "ru" ? "История версий" : "Release history");
    expect(state.checkRight).not.toHaveBeenCalled();
  });

  it("escapes hostile release notes and never renders executable HTML", async () => {
    state.history.mockResolvedValueOnce({
      releases: [{ ...release, releaseNotes: '<script>alert("danger")</script>' }],
      page: 1,
      pageSize: 12,
      totalPages: 1,
      total: 1,
    });
    const html = renderToStaticMarkup(await page());
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("PRIVATE_STORAGE_PATH");
  });

  it("renders an exact build-ID download only for entitled accounts", async () => {
    state.user = { id: "usr_buyer", role: "user" };
    state.entitled = true;
    const html = renderToStaticMarkup(await page());
    expect(state.checkRight).toHaveBeenCalledWith(
      { type: "user", id: "usr_buyer" },
      "prd_release",
      "product.download",
    );
    expect(html).toContain('data-build="bld_clean_1"');
    expect(html).toContain('data-resource="prd_release"');
    expect(html).toContain('data-version="1.2.0"');
  });

  it("allows a current manager while denying an unentitled user", async () => {
    state.user = { id: "usr_manager", role: "user" };
    state.manager = true;
    expect(renderToStaticMarkup(await page())).toContain('data-build="bld_clean_1"');
    expect(state.checkRight).not.toHaveBeenCalled();
    state.manager = false;
    const denied = renderToStaticMarkup(await page());
    expect(denied).not.toContain('data-build="bld_clean_1"');
  });

  it("never asks for builds when the resource is unpublished or unavailable", async () => {
    state.product = null;
    await expect(page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(state.history).not.toHaveBeenCalled();
    expect(state.checkRight).not.toHaveBeenCalled();
  });

  it("preserves sanitized pagination and marks pages as non-indexable", async () => {
    state.history.mockResolvedValueOnce({
      releases: [release],
      page: 2,
      pageSize: 12,
      totalPages: 3,
      total: 25,
    });
    const html = renderToStaticMarkup(await page("2"));
    expect(html).toContain('href="/market/safe-release/versions"');
    expect(html).toContain('href="/market/safe-release/versions?page=3"');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    await page(["1", "2"]);
    expect(state.history).toHaveBeenLastCalledWith("prd_release", 1);
  });
});
