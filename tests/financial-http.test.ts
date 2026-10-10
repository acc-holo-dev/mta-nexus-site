import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  statement: vi.fn(),
  scopes: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/db", () => ({
  financialStatementsRepository: { statement: state.statement, scopes: state.scopes },
  financialReviewRepository: { page: state.page, detail: state.detail },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: async (...args: unknown[]) => {
    state.rate(...args);
    return { success: state.allowed };
  },
}));
import { GET as statement } from "../apps/web/src/app/api/finance/route";
import { GET as scopes } from "../apps/web/src/app/api/finance/scopes/route";
import { GET as review } from "../apps/web/src/app/api/admin/commerce/reconciliation/route";
import { GET as detail } from "../apps/web/src/app/api/admin/commerce/reconciliation/[id]/route";
const get = (path: string) => new NextRequest(`https://nexus.test${path}`),
  context = { params: Promise.resolve({ id: "ord_a" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.allowed = true;
  for (const fn of [state.statement, state.scopes, state.page, state.detail])
    fn.mockReset().mockResolvedValue({});
});
it.each([statement, scopes, review, (r: NextRequest) => detail(r, context)])(
  "requires a session for financial evidence",
  async (route) => {
    state.user = null;
    const response = await route(get("/api/finance"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.statement).not.toHaveBeenCalled();
    expect(state.page).not.toHaveBeenCalled();
  },
);
it("uses the current account and validated currency/organization scope", async () => {
  const response = await statement(get("/api/finance?currency=EUR&organizationId=org_a&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(state.statement).toHaveBeenCalledWith("usr_a", 2, "EUR", "org_a");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
});
it.each(["accountId=user:other", "userId=other", "page=1&page=2", "currency=BTC"])(
  "rejects malicious query %s",
  async (query) => {
    expect((await statement(get(`/api/finance?${query}`))).status).toBe(400);
    expect(state.statement).not.toHaveBeenCalled();
  },
);
it("preserves privacy when current organization access has been revoked", async () => {
  state.statement.mockRejectedValue(new AppError("Secret organization", 404, "NOT_FOUND"));
  const response = await statement(get("/api/finance?organizationId=org_a"));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
it("rate limits all financial reads before repository access", async () => {
  state.allowed = false;
  expect((await statement(get("/api/finance"))).status).toBe(429);
  expect((await scopes(get("/api/finance/scopes"))).status).toBe(429);
  expect(state.statement).not.toHaveBeenCalled();
  expect(state.scopes).not.toHaveBeenCalled();
});
it("general moderators cannot inspect financial evidence", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  expect((await review(get("/api/admin/commerce/reconciliation"))).status).toBe(403);
  expect(state.page).not.toHaveBeenCalled();
});
it("uses the repository's live admin check for an apparent administrator", async () => {
  state.user = { id: "usr_a", role: "admin" };
  state.detail.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  expect(
    (await detail(get("/api/admin/commerce/reconciliation/ord_a?page=2"), context)).status,
  ).toBe(403);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "ord_a", 2);
});
