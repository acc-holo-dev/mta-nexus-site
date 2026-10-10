import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, NotFoundError } from "@nexus/domain";

const product = vi.hoisted(() => ({
  updateWithAudit: vi.fn(),
  suspendPublished: vi.fn(),
  restoreSuspendedWithPublishedBuild: vi.fn(),
  findById: vi.fn(),
}));

const moderation = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({ resourceModerationService: moderation }));

const report = vi.hoisted(() => ({
  resolve: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: vi.fn(),
  };
});

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_mod",
      username: "moderator",
      role: "moderator",
    })),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    reviewBuild: vi.fn(),
    quarantineBuild: vi.fn(),
    restoreQuarantinedBuild: vi.fn(),
  },
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    moderateContent: vi.fn(),
  },
}));

vi.mock(
  "../apps/web/src/lib/services/server-follow-notification-service",
  () => ({
    notifyServerFollowersOfPublishedContent: vi.fn(),
  }),
);

vi.mock("@nexus/db", () => ({
  productRepository: product,
  reportRepository: report,
  verificationRepository: {
    resolveRequest: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("@nexus/security", () => ({
  can: vi.fn(() => true),
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { NextRequest } from "next/server";
import { POST } from "../apps/web/src/app/api/admin/actions/route";

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

function request(
  targetType: "product" | "report",
  targetId: string,
  action: string,
) {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    },
    body: JSON.stringify({
      targetType,
      targetId,
      action,
      notes: "Moderation evidence.",
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
    }),
  });
}

describe("moderation action integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moderation.command.mockReset().mockRejectedValue(new NotFoundError("Product", "prd_missing"));
    product.updateWithAudit.mockResolvedValue(null);
    product.suspendPublished.mockResolvedValue(null);
    product.restoreSuspendedWithPublishedBuild.mockResolvedValue(
      "not_found",
    );
    product.findById.mockResolvedValue(null);
    report.resolve.mockResolvedValue(false);
    report.findById.mockResolvedValue(null);
  });

  it("requires a revision and refuses a cross-site legacy restore", async () => {
    for (const crossSite of [false, true]) {
      const headers = new Headers({ "content-type": "application/json" });
      if (crossSite) headers.set("sec-fetch-site", "cross-site");
      const response = await POST(new NextRequest("http://nexus.test/api/admin/actions", {
        method: "POST", headers,
        body: JSON.stringify({ targetType: "product", targetId: "prd_a", action: "restore", notes: "Reviewed evidence" }),
      }));
      expect(response.status).toBe(crossSite ? 403 : 400);
      expectPrivate(response);
    }
    expect(moderation.command).not.toHaveBeenCalled();
    expect(product.restoreSuspendedWithPublishedBuild).not.toHaveBeenCalled();
  });

  it.each(["feature", "unfeature"] as const)(
    "returns 404 when product %s cannot atomically update the target",
    async (action) => {
      const response = await POST(
        request("product", "prd_missing", action),
      );

      expect(response.status).toBe(404);
      expectPrivate(response);
      expect(await response.json()).toEqual({
        error: "Product not found",
      });
      expect(product.updateWithAudit).toHaveBeenCalledWith(
        "prd_missing",
        { isFeatured: action === "feature" },
        expect.objectContaining({
          actorId: "usr_mod",
          action: `admin.${action}`,
          targetId: "prd_missing",
          targetType: "product",
        }),
      );
    },
  );

  it("distinguishes a missing product from a suspend compare-and-set loss", async () => {
    const missing = await POST(
      request("product", "prd_missing", "suspend"),
    );
    expect(missing.status).toBe(404);
    expectPrivate(missing);
    expect(await missing.json()).toMatchObject({ code: "NOT_FOUND" });

    moderation.command.mockRejectedValueOnce(new AppError("Resource state changed", 409, "PRODUCT_STATE_CHANGED"));
    const stale = await POST(
      request("product", "prd_existing", "suspend"),
    );
    expect(stale.status).toBe(409);
    expectPrivate(stale);
    expect(await stale.json()).toMatchObject({
      code: "PRODUCT_STATE_CHANGED",
    });
  });

  it("returns 404 when restore reports that the product does not exist", async () => {
    const response = await POST(
      request("product", "prd_missing", "restore"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
    expect(moderation.command).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_mod" }), "prd_missing",
      { action: "release", reason: "Moderation evidence.", expectedUpdatedAt: "2026-10-10T12:00:00.000Z" },
    );
    expect(product.restoreSuspendedWithPublishedBuild).not.toHaveBeenCalled();
  });

  it("distinguishes a missing report from a moderation race", async () => {
    const missing = await POST(
      request("report", "rpt_missing", "resolve"),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: "Report not found",
    });

    report.findById.mockResolvedValueOnce({
      id: "rpt_existing",
      status: "open",
    });
    const stale = await POST(
      request("report", "rpt_existing", "dismiss"),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      code: "REPORT_STATE_CHANGED",
    });
  });
});
