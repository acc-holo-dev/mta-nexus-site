import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "admin" } as null | {
    id: string;
    role: "admin" | "moderator" | "user";
  },
  allowed: true,
  catalog: vi.fn(),
  published: vi.fn(),
  adminPage: vi.fn(),
  adminDetail: vi.fn(),
  command: vi.fn(),
  detail: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/db", () => ({
  commercialPlanRepository: {
    catalog: state.catalog,
    published: state.published,
    adminPage: state.adminPage,
    adminDetail: state.adminDetail,
    command: state.command,
  },
  orderOperationsRepository: { buyerDetail: state.detail, cancel: state.cancel },
}));
vi.mock("@nexus/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/security")>()),
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
import { GET as catalog } from "../apps/web/src/app/api/commerce/plans/route";
import { GET as estimate } from "../apps/web/src/app/api/commerce/estimate/route";
import {
  GET as adminPage,
  POST as create,
} from "../apps/web/src/app/api/admin/commerce/plans/route";
import { POST as edit } from "../apps/web/src/app/api/admin/commerce/plans/[id]/route";
import { GET as detail } from "../apps/web/src/app/api/orders/[id]/operations/route";
import { POST as cancel } from "../apps/web/src/app/api/orders/[id]/cancel/route";
import { consumeRateLimit } from "@nexus/security";
const ctx = { params: Promise.resolve({ id: "ord_a" }) },
  planCtx = { params: Promise.resolve({ id: "cplan_a" }) };
const terms = {
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD",
  durationDays: 30,
  commissionBps: 750,
};
const cancellation = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
  reason: "No longer needed",
};
const request = (path: string, body?: unknown, headers?: Record<string, string>) =>
  new NextRequest(
    `https://nexus.test${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        },
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "admin" };
  state.allowed = true;
  state.catalog.mockReset().mockResolvedValue({ plans: [] });
  state.published
    .mockReset()
    .mockResolvedValue({ ...terms, id: "cplan_a", revision: 2, scope: "user" });
  state.command.mockReset().mockResolvedValue({ plan: {} });
  state.adminPage.mockReset().mockResolvedValue({ plans: [] });
  state.detail.mockReset().mockResolvedValue({ attempts: [], canCancel: false });
  state.cancel.mockReset().mockResolvedValue({
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: cancellation.requestId,
    cancelledAt: new Date("2026-10-10T12:00:00.001Z"),
  });
});
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
it.each(["user", "moderator"] as const)(
  "keeps plan administration out of %s authority",
  async (role) => {
    state.user = { id: "usr_a", role };
    expect((await adminPage(request("/api/admin/commerce/plans"))).status).toBe(403);
    expect(
      (
        await create(
          request("/api/admin/commerce/plans", {
            action: "create",
            slug: "seller-plan",
            scope: "user",
            terms,
            reason: "Terms checked",
          }),
        )
      ).status,
    ).toBe(403);
    expect(state.adminPage).not.toHaveBeenCalled();
    expect(state.command).not.toHaveBeenCalled();
  },
);
it("passes the actual actor and a validated draft command with private response headers", async () => {
  const response = await create(
    request("/api/admin/commerce/plans", {
      action: "create",
      slug: "seller-plan",
      scope: "user",
      terms,
      reason: "Terms checked",
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      planId: expect.stringMatching(/^cplan_/u),
      command: expect.objectContaining({ action: "create", terms }),
    }),
  );
  expect(consumeRateLimit).toHaveBeenCalledWith("moderationAction", "usr_a");
});
it("rejects a create command sent to an existing plan", async () => {
  expect(
    (
      await edit(
        request("/api/admin/commerce/plans/cplan_a", {
          action: "create",
          slug: "seller-plan",
          scope: "user",
          terms,
          reason: "Terms checked",
        }),
        planCtx,
      )
    ).status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it.each([
  [{ "sec-fetch-site": "cross-site" }, cancellation, 403],
  [{ "content-type": "text/plain" }, cancellation, 415],
  [{}, { ...cancellation, padding: "x".repeat(5000) }, 413],
  [{}, { ...cancellation, buyerId: "usr_other" }, 400],
] as const)("rejects unsafe cancellation before mutation", async (headers, body, status) => {
  expect((await cancel(request("/api/orders/ord_a/cancel", body, headers), ctx)).status).toBe(
    status,
  );
  expect(state.cancel).not.toHaveBeenCalled();
});
it("takes cancellation ownership only from the session and returns a durable timestamp", async () => {
  const response = await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx);
  expect(response.status).toBe(200);
  expect(state.cancel).toHaveBeenCalledWith(
    expect.objectContaining({ buyerId: "usr_a", orderId: "ord_a", command: cancellation }),
  );
  expect(await response.json()).toMatchObject({ cancelledAt: "2026-10-10T12:00:00.001Z" });
});
it("does not disclose internal reconciliation details", async () => {
  state.cancel.mockRejectedValue(
    new AppError("PRIVATE PROVIDER DETAIL", 409, "ORDER_RECONCILIATION_REQUIRED"),
  );
  expect(
    await (await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx)).json(),
  ).toEqual({ code: "ORDER_RECONCILIATION_REQUIRED" });
});
it("requires login before fetching the buyer archive or cancelling", async () => {
  state.user = null;
  expect((await detail(request("/api/orders/ord_a/operations"), ctx)).status).toBe(401);
  expect((await cancel(request("/api/orders/ord_a/cancel", cancellation), ctx)).status).toBe(401);
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.cancel).not.toHaveBeenCalled();
});
