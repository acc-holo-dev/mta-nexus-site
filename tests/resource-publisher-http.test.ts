import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "developer" } as { id: string; role: "developer" } | null,
  rate: vi.fn(),
  inventory: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/db", () => ({
  resourcePublisherRepository: { inventory: state.inventory, history: state.history },
}));
import { GET as inventory } from "../apps/web/src/app/api/workspace/resources/route";
import { GET as history } from "../apps/web/src/app/api/products/[id]/history/route";
const context = { params: Promise.resolve({ id: "prd_a" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "developer" };
  state.rate.mockResolvedValue({ success: true });
  state.inventory.mockResolvedValue({ items: [], total: 0 });
  state.history.mockResolvedValue({ items: [], total: 0 });
});
it("authenticates and bounds inventory/history before returning private no-store data", async () => {
  const response = await inventory(
    new NextRequest(
      "https://nexus.test/api/workspace/resources?scope=personal&status=draft&page=2",
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(state.inventory).toHaveBeenCalledWith(
    "usr_a",
    expect.objectContaining({ scope: "personal", status: "draft", page: 2 }),
    2,
  );
  expect(
    (
      await history(
        new NextRequest("https://nexus.test/api/products/prd_a/history?kind=changes&page=2"),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.history).toHaveBeenCalledWith("prd_a", "usr_a", "changes", 2);
});
it("denies guests, malformed selectors, rate excess and live scope revocation", async () => {
  state.user = null;
  expect(
    (await inventory(new NextRequest("https://nexus.test/api/workspace/resources"))).status,
  ).toBe(401);
  expect(state.inventory).not.toHaveBeenCalled();
  state.user = { id: "usr_a", role: "developer" };
  expect(
    (
      await inventory(
        new NextRequest("https://nexus.test/api/workspace/resources?ownerId=usr_other"),
      )
    ).status,
  ).toBe(400);
  state.rate.mockResolvedValue({ success: false });
  expect(
    (await inventory(new NextRequest("https://nexus.test/api/workspace/resources"))).status,
  ).toBe(429);
  state.rate.mockResolvedValue({ success: true });
  state.history.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  const denied = await history(
    new NextRequest("https://nexus.test/api/products/prd_a/history"),
    context,
  );
  expect(denied.status).toBe(404);
  expect(await denied.json()).toEqual({ code: "NOT_FOUND" });
});
