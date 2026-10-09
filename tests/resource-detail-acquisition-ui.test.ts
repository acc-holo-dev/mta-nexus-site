import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    username: string;
    role: "user" | "admin";
  },
  entitled: false,
  canManage: false,
  locale: "en" as "en" | "ru",
  product: null as null | Record<string, unknown>,
  builds: [] as Array<Record<string, unknown>>,
}));

const productService = vi.hoisted(() => ({
  getProductBySlug: vi.fn(async () => state.product),
  getProductPreviewBySlug: vi.fn(async () => state.product),
  canManageProduct: vi.fn(async () => state.canManage),
  getProductBuilds: vi.fn(async () => state.builds),
  getDependencyResolution: vi.fn(async () => null),
  getReverseDependencySummary: vi.fn(async () => null),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "nexus_session" && state.user
        ? { value: "session-token" }
        : undefined,
  })),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => state.locale),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: {
    checkEntitlement: vi.fn(async () => state.entitled),
  },
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    getComments: vi.fn(async () => []),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService,
}));

vi.mock("../apps/web/src/components/resource-preview", async () => {
  const ReactModule = await import("react");
  return {
    ResourcePreview: ({ title }: { title: string }) =>
      ReactModule.createElement("div", {
        "data-testid": "resource-preview",
        "data-title": title,
      }),
  };
});

vi.mock("../apps/web/src/components/resource-download-button", async () => {
  const ReactModule = await import("react");
  return {
    ResourceDownloadButton: ({
      productId,
      version,
    }: {
      productId: string;
      version: string;
    }) =>
      ReactModule.createElement("button", {
        "data-testid": "resource-download",
        "data-product-id": productId,
        "data-version": version,
      }),
  };
});

vi.mock("../apps/web/src/components/build-provenance-details", async () => {
  const ReactModule = await import("react");
  return {
    BuildProvenanceDetails: ({ build }: { build: { id: string } }) =>
      ReactModule.createElement("div", {
        "data-testid": "build-provenance",
        "data-build-id": build.id,
      }),
  };
});

vi.mock("../apps/web/src/components/product-dependency-list", async () => {
  const ReactModule = await import("react");
  return {
    ProductDependencyList: () =>
      ReactModule.createElement("span", {
        "data-testid": "product-dependencies",
      }),
  };
});

vi.mock("../apps/web/src/components/reverse-dependency-list", async () => {
  const ReactModule = await import("react");
  return {
    ReverseDependencyList: () =>
      ReactModule.createElement("span", {
        "data-testid": "reverse-dependencies",
      }),
  };
});

import ProductDetailPage, { generateMetadata } from "../apps/web/src/app/market/[slug]/page";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import { contentService } from "../apps/web/src/lib/services/content-service";
import { authService } from "../apps/web/src/lib/services/auth-service";
import { getRequestLocale } from "../apps/web/src/lib/i18n-server";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function product(price = 0) {
  return {
    id: "prd_detail",
    slug: "detail-resource",
    title: "Detail Resource",
    shortDescription: "Short resource description",
    description: "A detailed resource description for the behavior test.",
    thumbnailUrl: null,
    type: "script",
    price,
    currency: "USD",
    licenseModel: "unlimited",
    currentVersion: "2.0.0",
    status: "published",
    tags: ["utility"],
    compatibility: {
      mtaMinVersion: "1.6.0",
      dependencies: [],
    },
    salesCount: 12,
    ratingAverage: 45,
    ratingCount: 4,
  };
}

function build(id: string, version: string) {
  return {
    id,
    productId: "prd_detail",
    version,
    status: "published",
    sha256Hash: id.padEnd(64, "a").slice(0, 64),
    fileName: `${id}.zip`,
    fileSizeBytes: 4096,
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "clamav",
    scannedAt: new Date("2026-10-08T00:00:00.000Z"),
    mtaVersionTarget: "1.6.0",
    isSigned: false,
    releaseNotes: null,
  };
}

describe("resource detail acquisition behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    state.entitled = false;
    state.canManage = false;
    state.locale = "en";
    state.product = product(0);
    state.builds = [
      build("bld_latest", "2.0.0"),
      build("bld_old", "1.0.0"),
    ];
  });

  it("starts public metadata lookup while locale resolution is pending", async () => {
    const locale = deferred<"en">();
    vi.mocked(getRequestLocale).mockReturnValueOnce(locale.promise);
    const result = generateMetadata({ params: Promise.resolve({ slug: "detail-resource" }) });
    try {
      await vi.waitFor(() => expect(getRequestLocale).toHaveBeenCalledOnce());
      expect(productService.getProductBySlug).toHaveBeenCalledExactlyOnceWith("detail-resource");
    } finally {
      locale.resolve("en");
      expect((await result).title).toBe("Detail Resource");
    }
  });

  it("starts session lookup while page locale resolution is pending", async () => {
    state.user = { id: "usr_reader", username: "reader", role: "user" };
    const locale = deferred<"en">();
    vi.mocked(getRequestLocale).mockReturnValueOnce(locale.promise);
    const page = ProductDetailPage({ params: Promise.resolve({ slug: "detail-resource" }) });
    try {
      await vi.waitFor(() => expect(getRequestLocale).toHaveBeenCalledOnce());
      expect(authService.getSession).toHaveBeenCalledExactlyOnceWith("session-token");
    } finally {
      locale.resolve("en");
      expect(renderToStaticMarkup(await page)).toContain("Detail Resource");
    }
  });

  it.each([true, false])("starts independent reads and waits for management decision %s before builds", async canManage => {
    state.user = { id: "usr_manager", username: "manager", role: "user" };
    const management = deferred<boolean>();
    const entitlement = deferred<boolean>();
    productService.canManageProduct.mockReturnValueOnce(management.promise);
    vi.mocked(commerceService.checkEntitlement).mockReturnValueOnce(entitlement.promise);
    let settled = false;
    const page = ProductDetailPage({ params: Promise.resolve({ slug: "detail-resource" }) })
      .then(element => { settled = true; return element; });
    try {
      await vi.waitFor(() => expect(productService.canManageProduct).toHaveBeenCalledOnce());
      expect(commerceService.checkEntitlement).toHaveBeenCalledOnce();
      expect(contentService.getComments).toHaveBeenCalledOnce();
      expect(productService.getDependencyResolution).toHaveBeenCalledOnce();
      expect(productService.getReverseDependencySummary).toHaveBeenCalledOnce();
      expect(productService.getProductBuilds).not.toHaveBeenCalled();
      management.resolve(canManage);
      await vi.waitFor(() => expect(productService.getProductBuilds).toHaveBeenCalledWith("prd_detail", canManage));
      expect(settled).toBe(false);
    } finally {
      management.resolve(canManage);
      entitlement.resolve(false);
      const html = renderToStaticMarkup(await page);
      if (canManage) {
        expect(html).toContain(getDictionary("en").product.managementAccess);
        expect(html).toContain('data-testid="resource-download"');
      } else {
        expect(html).toContain('href="/acquire?productId=prd_detail"');
        expect(html).not.toContain('data-testid="resource-download"');
      }
    }
  });

  it("does not load detail data after a denied or missing preview", async () => {
    state.product = null;
    await expect(ProductDetailPage({ params: Promise.resolve({ slug: "private-resource" }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
    expect(productService.canManageProduct).not.toHaveBeenCalled();
    expect(commerceService.checkEntitlement).not.toHaveBeenCalled();
    expect(productService.getProductBuilds).not.toHaveBeenCalled();
    expect(contentService.getComments).not.toHaveBeenCalled();
    expect(productService.getDependencyResolution).not.toHaveBeenCalled();
    expect(productService.getReverseDependencySummary).not.toHaveBeenCalled();
  });

  it("does not read build history when management fails, even with another pending read", async () => {
    state.user = { id: "usr_reader", username: "reader", role: "user" };
    const management = deferred<boolean>();
    const entitlement = deferred<boolean>();
    productService.canManageProduct.mockReturnValueOnce(management.promise);
    vi.mocked(commerceService.checkEntitlement).mockReturnValueOnce(entitlement.promise);
    const page = ProductDetailPage({ params: Promise.resolve({ slug: "detail-resource" }) });
    const failed = expect(page).rejects.toThrow("Permission read failed");
    try {
      await vi.waitFor(() => expect(commerceService.checkEntitlement).toHaveBeenCalledOnce());
      management.reject(new Error("Permission read failed"));
      await failed;
      expect(productService.getProductBuilds).not.toHaveBeenCalled();
      // Promise.all must also handle a later failure after its first rejection.
      entitlement.reject(new Error("Late entitlement failure"));
      await Promise.resolve();
    } finally {
      management.reject(new Error("Permission read failed"));
      entitlement.resolve(false);
      await failed;
    }
  });

  it.each(["en", "ru"] as const)(
    "routes an unclaimed free resource through acquisition in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getDictionary(locale).product;
      const html = renderToStaticMarkup(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "detail-resource" }),
        }),
      );

      expect(html).toContain("Detail Resource");
      expect(html).toContain(
        'href="/acquire?productId=prd_detail"',
      );
      expect(html).toContain(copy.addToLibrary);
      expect(html).toContain(copy.latestBuildNotice);
      expect(
        (html.match(/data-testid="build-provenance"/gu) ?? []).length,
      ).toBe(2);
      expect(html).not.toContain('data-testid="resource-download"');
      expect(html).not.toContain(
        getDictionary(locale).checkout.paidDisabled,
      );
    },
  );

  it("keeps paid closed-beta resources visibly disabled without acquisition mutations", async () => {
    state.product = product(1999);
    const dictionary = getDictionary("en");

    const html = renderToStaticMarkup(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(html).toContain(dictionary.checkout.paidUnavailable);
    expect(html).toContain(dictionary.checkout.paidDisabled);
    expect(html).not.toContain("/acquire?productId=prd_detail");
    expect(html).not.toContain("/checkout?productId=prd_detail");
    expect(html).not.toContain('data-testid="resource-download"');
  });

  it("renders exactly one latest-build download action for an entitled user regardless of build history length", async () => {
    state.user = {
      id: "usr_entitled",
      username: "entitled",
      role: "user",
    };
    state.entitled = true;

    const html = renderToStaticMarkup(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(productService.getProductBuilds).toHaveBeenCalledWith(
      "prd_detail",
      false,
    );
    expect(
      (html.match(/data-testid="resource-download"/gu) ?? []).length,
    ).toBe(1);
    expect(html).toContain('data-product-id="prd_detail"');
    expect(html).toContain('data-version="2.0.0"');
    expect(html).toContain('href="/workspace"');
    expect(html).not.toContain("/acquire?productId=prd_detail");
  });

  it("lets a current manager inspect builds and download without entitlement", async () => {
    state.user = {
      id: "usr_manager",
      username: "manager",
      role: "user",
    };
    state.canManage = true;

    const html = renderToStaticMarkup(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(productService.getProductBuilds).toHaveBeenCalledWith(
      "prd_detail",
      true,
    );
    expect(
      (html.match(/data-testid="resource-download"/gu) ?? []).length,
    ).toBe(1);
    expect(html).toContain(getDictionary("en").product.managementAccess);
  });
});
