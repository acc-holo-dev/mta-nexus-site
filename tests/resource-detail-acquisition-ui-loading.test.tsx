import { describe, expect, it, vi } from "vitest";

// Keep unit classification: entry-level full mock cuts the @nexus/db import edge.
vi.mock("@nexus/db", () => ({
  resourceMediaRepository: { publicItems: async () => [], managed: async () => ({ items: [] }) },
  notificationRepository: {
    getPreferences: vi.fn(async () => ({
      followsEnabled: true,
      contentEnabled: true,
      serverEnabled: true,
      commerceEnabled: true,
      systemEnabled: true,
    })),
  },
  followWorkspaceRepository: {
    states: vi.fn(async () => [] as string[]),
    muteState: vi.fn(async () => ({ muted: false, mutedUntil: null })),
  },
}));

import "./helpers/resource-detail-acquisition-ui-harness";
import ProductDetailPage, { generateMetadata } from "../apps/web/src/app/market/[slug]/page";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { getRequestLocale } from "../apps/web/src/lib/i18n-server";
import { authService } from "../apps/web/src/lib/services/auth-service";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import { resourceReviewService } from "../apps/web/src/lib/services/resource-review-service";
import {
  deferred,
  productService,
  renderPage,
  setupResourceDetailAcquisitionUi,
  state,
} from "./helpers/resource-detail-acquisition-ui-state";

setupResourceDetailAcquisitionUi();

describe("resource detail acquisition loading", () => {
  it("labels a published resource without a safe build as a private manager preview", async () => {
    state.user = { id: "usr_owner", username: "owner", role: "user" };
    state.canManage = true;
    state.isPublic = false;
    const copy = getDictionary("en").product;
    const html = renderPage(
      await ProductDetailPage({ params: Promise.resolve({ slug: "detail-resource" }) }),
    );
    expect(html).toContain(copy.privatePreview);
    expect(html).toContain(copy.notPublic);
    expect(html).not.toContain('data-testid="resource-qa"');
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
      expect(renderPage(await page)).toContain("Detail Resource");
    }
  });

  it.each([true, false])(
    "starts independent reads and waits for management decision %s before builds",
    async (canManage) => {
      state.user = { id: "usr_manager", username: "manager", role: "user" };
      const management = deferred<boolean>();
      const entitlement = deferred<boolean>();
      productService.canManageProduct.mockReturnValueOnce(management.promise);
      vi.mocked(commerceService.checkEntitlement).mockReturnValueOnce(entitlement.promise);
      let settled = false;
      const page = ProductDetailPage({ params: Promise.resolve({ slug: "detail-resource" }) }).then(
        (element) => {
          settled = true;
          return element;
        },
      );
      try {
        await vi.waitFor(() => expect(productService.canManageProduct).toHaveBeenCalledOnce());
        expect(commerceService.checkEntitlement).toHaveBeenCalledOnce();
        expect(resourceReviewService.publicPage).toHaveBeenCalledOnce();
        expect(productService.getDependencyResolution).toHaveBeenCalledOnce();
        expect(productService.getReverseDependencySummary).toHaveBeenCalledOnce();
        expect(productService.getProductBuilds).not.toHaveBeenCalled();
        management.resolve(canManage);
        await vi.waitFor(() =>
          expect(productService.getProductBuilds).toHaveBeenCalledWith("prd_detail", canManage),
        );
        expect(settled).toBe(false);
      } finally {
        management.resolve(canManage);
        entitlement.resolve(false);
        const html = renderPage(await page);
        if (canManage) {
          expect(html).toContain(getDictionary("en").product.managementAccess);
          expect(html).toContain('data-testid="resource-download"');
        } else {
          expect(html).toContain('href="/acquire?productId=prd_detail"');
          expect(html).not.toContain('data-testid="resource-download"');
        }
      }
    },
  );

  it("does not load detail data after a denied or missing preview", async () => {
    state.product = null;
    await expect(
      ProductDetailPage({ params: Promise.resolve({ slug: "private-resource" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(productService.canManageProduct).not.toHaveBeenCalled();
    expect(commerceService.checkEntitlement).not.toHaveBeenCalled();
    expect(productService.getProductBuilds).not.toHaveBeenCalled();
    expect(resourceReviewService.publicPage).not.toHaveBeenCalled();
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
});
