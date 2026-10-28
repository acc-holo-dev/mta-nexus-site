import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn(async () => null) }));
const rate = vi.hoisted(() => vi.fn());
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService: auth }));
vi.mock("@nexus/security", () => ({ consumeRateLimit: rate }));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({ commerceService: {} }));
vi.mock("../apps/web/src/lib/services/commercial-plan-service", () => ({
  commercialPlanService: {},
  orderOperationsService: {},
}));
vi.mock("../apps/web/src/lib/services/order-case-service", () => ({ orderCaseService: {} }));
vi.mock("../apps/web/src/lib/services/subscriptions-service", () => ({ subscriptionsService: {} }));
vi.mock("../apps/web/src/lib/services/plan-reviews-service", () => ({ planReviewsService: {} }));
vi.mock("../apps/web/src/lib/services/resource-review-service", () => ({
  resourceReviewService: {},
}));

import { POST as orderCase } from "../apps/web/src/app/api/admin/commerce/order-cases/[id]/route";
import { POST as editPlan } from "../apps/web/src/app/api/admin/commerce/plans/[id]/route";
import { POST as createPlan } from "../apps/web/src/app/api/admin/commerce/plans/route";
import { POST as reviewReport } from "../apps/web/src/app/api/admin/commerce/reviews/[id]/route";
import { POST as checkout } from "../apps/web/src/app/api/checkout/route";
import { POST as cancel } from "../apps/web/src/app/api/orders/[id]/cancel/route";
import { POST as support } from "../apps/web/src/app/api/orders/[id]/support/route";
import { POST as acquire } from "../apps/web/src/app/api/resources/cart/acquire/route";
import { POST as add, DELETE as remove } from "../apps/web/src/app/api/resources/cart/route";
import { POST as subscription } from "../apps/web/src/app/api/subscriptions/account/route";
import { POST as planReview } from "../apps/web/src/app/api/subscriptions/reviews/route";

const context = { params: Promise.resolve({ id: "target_a" }) };
const routes = [
  ["checkout", "POST", checkout],
  ["orders/ord_a/cancel", "POST", cancel],
  ["orders/ord_a/support", "POST", support],
  ["resources/cart/acquire", "POST", acquire],
  ["resources/cart", "POST", add],
  ["resources/cart", "DELETE", remove],
  ["subscriptions/account", "POST", subscription],
  ["subscriptions/reviews", "POST", planReview],
  ["admin/commerce/order-cases/case_a", "POST", orderCase],
  ["admin/commerce/plans", "POST", createPlan],
  ["admin/commerce/plans/plan_a", "POST", editPlan],
  ["admin/commerce/reviews/report_a", "POST", reviewReport],
] as const;
const denied = [
  ["missing provenance", {}],
  [
    "cross-origin with a bearer token",
    { origin: "https://evil.test", authorization: "Bearer forged" },
  ],
  ["sibling-site context", { origin: "https://nexus.test", "sec-fetch-site": "same-site" }],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

for (const [reason, headers] of denied) {
  describe(`commerce routes reject ${reason} without Proxy`, () => {
    it.each(routes)("%s %s", async (path, method, handler) => {
      const request = new NextRequest(`https://nexus.test/api/${path}`, {
        method,
        headers: { cookie: "nexus_session=owner", "content-type": "application/json", ...headers },
        body: "{invalid JSON",
      });
      const response = await handler(request, context as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toContain("Origin");
      expect(request.bodyUsed).toBe(false);
      expect(auth.getSession).not.toHaveBeenCalled();
      expect(rate).not.toHaveBeenCalled();
    });
  });
}

it.each(routes)(
  "same-origin %s %s retains its authentication or disabled-checkout contract",
  async (path, method, handler) => {
    const response = await handler(
      new NextRequest(`https://nexus.test/api/${path}`, {
        method,
        headers: {
          origin: "https://nexus.test",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      context as never,
    );
    if (path === "checkout") {
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "CHECKOUT_DISABLED" });
      expect(auth.getSession).not.toHaveBeenCalled();
    } else {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
      expect(auth.getSession).toHaveBeenCalledOnce();
    }
  },
);
