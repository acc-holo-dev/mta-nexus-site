import { expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
  return {
    authService: { getSession: async () => commercialOperationsHttpState.user },
  };
});
vi.mock("@nexus/db", async () => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
  return {
    commercialPlanRepository: {
      catalog: commercialOperationsHttpState.catalog,
      published: commercialOperationsHttpState.published,
      adminPage: commercialOperationsHttpState.adminPage,
      adminDetail: commercialOperationsHttpState.adminDetail,
      command: commercialOperationsHttpState.command,
    },
    orderOperationsRepository: {
      buyerDetail: commercialOperationsHttpState.detail,
      cancel: commercialOperationsHttpState.cancel,
    },
  };
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { commercialOperationsHttpState } = await import(
    "./helpers/commercial-operations-http-harness"
  );
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: vi.fn(async () => ({ success: commercialOperationsHttpState.allowed })),
  };
});

import { GET as estimate } from "../apps/web/src/app/api/commerce/estimate/route";
import { GET as catalog } from "../apps/web/src/app/api/commerce/plans/route";
import { GET as detail } from "../apps/web/src/app/api/orders/[id]/operations/route";
import {
  commercialOperationsHttpOrderCtx as ctx,
  commercialOperationsHttpRequest as request,
  commercialOperationsHttpState as state,
  commercialOperationsHttpTerms as terms,
  installCommercialOperationsHttpLifecycle,
} from "./helpers/commercial-operations-http-harness";

installCommercialOperationsHttpLifecycle();

it("serves a bounded public catalog without a session", async () => {
  state.user = null;
  const response = await catalog(request("/api/commerce/plans?scope=organization&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(state.catalog).toHaveBeenCalledWith("organization", 2);
});
it("quotes the published version without creating a subscription or payment", async () => {
  const response = await estimate(
    request("/api/commerce/estimate?amount=10000&currency=USD&planId=cplan_a&revision=2"),
  );
  expect(await response.json()).toMatchObject({
    platformFee: 750,
    sellerProceeds: 9250,
    subscriptionActivationAvailable: false,
    paidCheckoutAvailable: false,
    initialHoldDays: 7,
    plan: { id: "cplan_a", revision: 2 },
  });
  expect(state.command).not.toHaveBeenCalled();
});
it.each([null, { ...terms, id: "cplan_a", revision: 3 }])(
  "rejects a withdrawn or changed published version %j",
  async (value) => {
    state.published.mockResolvedValue(value);
    const response = await estimate(
      request("/api/commerce/estimate?amount=10000&currency=USD&planId=cplan_a&revision=2"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "COMMERCIAL_PLAN_QUOTE_CHANGED" });
  },
);
it("uses the base 10% quote without reading any plan", async () => {
  expect(
    await (await estimate(request("/api/commerce/estimate?amount=10000&currency=EUR"))).json(),
  ).toMatchObject({ commissionBps: 1000, platformFee: 1000, plan: null });
  expect(state.published).not.toHaveBeenCalled();
});
it.each(["?scope=user&scope=organization", "?status=draft", "?page=1001"])(
  "rejects invalid public catalog query %s",
  async (query) => {
    expect((await catalog(request(`/api/commerce/plans${query}`))).status).toBe(400);
    expect(state.catalog).not.toHaveBeenCalled();
  },
);
it("limits public quotes and authenticated commercial inspection", async () => {
  state.allowed = false;
  expect((await estimate(request("/api/commerce/estimate?amount=100&currency=USD"))).status).toBe(
    429,
  );
  expect((await detail(request("/api/orders/ord_a/operations"), ctx)).status).toBe(429);
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.published).not.toHaveBeenCalled();
});
