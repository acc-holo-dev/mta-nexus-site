import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rate: vi.fn(),
  create: vi.fn(),
  detail: vi.fn(),
  orderDetail: vi.fn(),
  page: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.auth },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/services/order-case-service", () => ({ orderCaseService: mocks }));
import { GET, POST } from "../apps/web/src/app/api/orders/[id]/support/route";
import { GET as caseGet } from "../apps/web/src/app/api/order-cases/[id]/route";
import { GET as queueGet } from "../apps/web/src/app/api/admin/commerce/order-cases/route";
import { POST as reviewPost } from "../apps/web/src/app/api/admin/commerce/order-cases/[id]/route";
const actor = { id: "usr_a", role: "user" },
  context = { params: Promise.resolve({ id: "ord_a" }) };
const draft = {
  requestId: "00000000-0000-4000-8000-000000000000",
  kind: "resource_issue",
  subject: " Resource issue ",
  message: " Please investigate my purchase. ",
  requestedAmount: null,
};
function request(
  method: string,
  path = "/api/orders/ord_a/support",
  body: unknown = draft,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.create.mockResolvedValue({ kind: "order_case_created" });
  mocks.review.mockResolvedValue({ kind: "order_case_reviewed", financialExecution: false });
});
it("authenticates before parsing and applies private response headers", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await POST(request("POST"), context);
  expect(response.status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
});
it("passes trimmed intake under the content creation rate policy", async () => {
  expect((await POST(request("POST"), context)).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    "ord_a",
    { ...draft, subject: "Resource issue", message: "Please investigate my purchase." },
    actor,
  );
  expect(mocks.rate).toHaveBeenCalledWith("contentCreation", actor.id);
});
it.each([
  [{ "sec-fetch-site": "cross-site" }, 403],
  [{ "content-type": "text/plain" }, 415],
  [{ "content-length": "24577" }, 413],
] as const)("bounds and protects intake", async (headers, status) => {
  expect((await POST(request("POST", undefined, draft, headers), context)).status).toBe(status);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("rejects extra authority and financial execution fields", async () => {
  expect(
    (await POST(request("POST", undefined, { ...draft, buyerId: "usr_b" }), context)).status,
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("throttles all private commercial views", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  for (const response of [
    await GET(request("GET"), context),
    await caseGet(request("GET", "/api/order-cases/sup_a"), context),
    await queueGet(request("GET", "/api/admin/commerce/order-cases")),
  ])
    expect(response.status).toBe(429);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("returns only conflict codes, never private internal details", async () => {
  mocks.create.mockRejectedValue(new AppError("private bank record", 409, "ORDER_CASE_EXISTS"));
  expect(await (await POST(request("POST"), context)).json()).toEqual({
    code: "ORDER_CASE_EXISTS",
  });
});
it("binds staff review to evidence, case revision and shared conversation revision", async () => {
  const command = {
    action: "start_review",
    expectedRevision: 1,
    expectedSupportUpdatedAt: "2026-10-11T00:00:00.000Z",
    expectedEvidenceHash: "a".repeat(64),
    notes: " Reviewed records ",
  };
  expect(
    (await reviewPost(request("POST", "/api/admin/commerce/order-cases/sup_a", command), context))
      .status,
  ).toBe(200);
  expect(mocks.review).toHaveBeenCalledWith(
    "ord_a",
    { ...command, notes: "Reviewed records" },
    actor,
  );
  expect(mocks.rate).toHaveBeenCalledWith("moderationAction", actor.id);
  expect(
    (
      await reviewPost(
        request("POST", "/api/admin/commerce/order-cases/sup_a", {
          ...command,
          expectedEvidenceHash: undefined,
        }),
        context,
      )
    ).status,
  ).toBe(400);
});
