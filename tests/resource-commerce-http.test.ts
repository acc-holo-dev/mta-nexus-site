import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { AppError } from "@nexus/domain";

const mocks = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  get: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  acquire: vi.fn(),
  transition: vi.fn(),
  order: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => mocks.user },
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: {
    getResourceCart: mocks.get,
    addResourceToCart: mocks.add,
    removeResourceFromCart: mocks.remove,
    acquireResourceCart: mocks.acquire,
    getBuyerOrderDetails: mocks.order,
  },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { transitionResource: mocks.transition },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
import { GET, POST, DELETE } from "../apps/web/src/app/api/resources/cart/route";
import { POST as acquire } from "../apps/web/src/app/api/resources/cart/acquire/route";
import { POST as lifecycle } from "../apps/web/src/app/api/products/[id]/lifecycle/route";
import { GET as orderDetails } from "../apps/web/src/app/api/orders/[id]/route";

const requestId = "607177bf-31df-4a67-a7d4-cba38c456d07";
function request(
  path: string,
  method = "POST",
  body: unknown = { productId: "prd_a" },
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://nexus.test/api/${path}`, {
    method,
    headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.resetAllMocks();
  mocks.user = { id: "usr_a" };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.get.mockResolvedValue({ items: [], limit: 20 });
  mocks.acquire.mockResolvedValue({
    kind: "free_resource_acquisition",
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
  });
});

it("denies signed-out reads and writes without touching commerce", async () => {
  mocks.user = null;
  for (const method of [GET, POST, DELETE]) {
    const response = await method(
      request("resources/cart", method === GET ? "GET" : method === POST ? "POST" : "DELETE"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
  }
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("binds the basket to the authenticated actor and confirms item changes", async () => {
  expect(await (await GET(request("resources/cart", "GET"))).json()).toEqual({
    items: [],
    limit: 20,
  });
  expect(mocks.get).toHaveBeenCalledWith(mocks.user);
  expect(await (await POST(request("resources/cart"))).json()).toEqual({
    productId: "prd_a",
    inCart: true,
  });
  expect(mocks.add).toHaveBeenCalledWith(mocks.user, "prd_a");
  expect(await (await DELETE(request("resources/cart", "DELETE"))).json()).toEqual({
    productId: "prd_a",
    inCart: false,
  });
});
it.each([
  [{ productId: "prd_a", userId: "usr_other" }, 400],
  [{ productId: "../private" }, 400],
  [{ productId: "a".repeat(4000) }, 413],
])("rejects unbounded or caller-controlled item metadata", async (body, status) => {
  expect((await POST(request("resources/cart", "POST", body))).status).toBe(status);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("rejects form encodings and cross-site mutations", async () => {
  expect(
    (await POST(request("resources/cart", "POST", {}, { "content-type": "text/plain" }))).status,
  ).toBe(415);
  expect(
    (await POST(request("resources/cart", "POST", {}, { "sec-fetch-site": "cross-site" }))).status,
  ).toBe(403);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("enforces account rate limits before reading commands", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await POST(request("resources/cart"))).status).toBe(429);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("passes the exact reviewed cart and receipt key to acquisition", async () => {
  const response = await acquire(
    request("resources/cart/acquire", "POST", { productIds: ["prd_a"], requestId, reviewDigest: "a".repeat(64) }),
  );
  expect(response.status).toBe(200);
  expect(mocks.acquire).toHaveBeenCalledWith(mocks.user, ["prd_a"], requestId, "a".repeat(64));
  expect(await response.json()).toMatchObject({ kind: "free_resource_acquisition" });
});
it.each([
  { productIds: ["prd_a", "prd_a"], requestId },
  { productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`), requestId },
  { productIds: ["prd_a"], requestId, paymentProvider: "mock" },
  { productIds: ["prd_a"] },
])("rejects duplicate, oversized, simulated-payment or keyless acquisitions", async (body) => {
  expect((await acquire(request("resources/cart/acquire", "POST", body))).status).toBe(400);
  expect(mocks.acquire).not.toHaveBeenCalled();
});
it("returns safe state conflicts without private repository data", async () => {
  mocks.acquire.mockRejectedValue(
    new AppError("private storage key", 409, "RESOURCE_CART_CHANGED", { private: "secret" }),
  );
  const response = await acquire(
    request("resources/cart/acquire", "POST", { productIds: ["prd_a"], requestId, reviewDigest: "a".repeat(64) }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "RESOURCE_CART_CHANGED" });
});
it("validates lifecycle commands and returns only the product revision", async () => {
  const command = {
    action: "archive",
    expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
    reason: "Withdraw this release",
  };
  mocks.transition.mockResolvedValue({
    id: "prd_a",
    status: "archived",
    updatedAt: new Date("2026-10-10T01:00:00Z"),
    private: "secret",
  });
  const params = { params: Promise.resolve({ id: "prd_a" }) };
  const response = await lifecycle(request("products/prd_a/lifecycle", "POST", command), params);
  expect(mocks.transition).toHaveBeenCalledWith("prd_a", command, mocks.user);
  expect(await response.json()).toEqual({
    product: { id: "prd_a", status: "archived", updatedAt: "2026-10-10T01:00:00.000Z" },
  });
  expect(
    (
      await lifecycle(
        request("products/prd_a/lifecycle", "POST", { ...command, action: "publish" }),
        params,
      )
    ).status,
  ).toBe(400);
});

it("reads order details only through the signed-in buyer scope", async () => {
  const params = { params: Promise.resolve({ id: "ord_a" }) };
  mocks.order.mockResolvedValue(null);
  expect((await orderDetails(request("orders/ord_a", "GET"), params)).status).toBe(404);
  expect(mocks.order).toHaveBeenCalledWith(mocks.user, "ord_a", 1);
  mocks.user = null;
  mocks.order.mockClear();
  expect((await orderDetails(request("orders/ord_a", "GET"), params)).status).toBe(401);
  expect(mocks.order).not.toHaveBeenCalled();
});
