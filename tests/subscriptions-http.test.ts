import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  command: vi.fn(),
  dashboard: vi.fn(),
  estimate: vi.fn(),
  history: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/db", () => ({
  commercialPlanRepository: {},
  financialStatementsRepository: {},
  subscriptionsRepository: {
    command: state.command,
    dashboard: state.dashboard,
    estimate: state.estimate,
    history: state.history,
    detail: state.detail,
  },
}));

import { GET as estimate } from "../apps/web/src/app/api/subscriptions/account/estimate/route";
import { GET as history } from "../apps/web/src/app/api/subscriptions/account/history/route";
import { GET as download } from "../apps/web/src/app/api/subscriptions/account/receipts/[id]/export/route";
import { GET as detail } from "../apps/web/src/app/api/subscriptions/account/receipts/[id]/route";
import { GET as dashboard, POST } from "../apps/web/src/app/api/subscriptions/account/route";
import { activation, cancellation, date, receipt, subscription } from "./subscriptions-fixtures";

const base = "/api/subscriptions/account",
  context = { params: Promise.resolve({ id: receipt.id }) };
const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://nexus.test${path}`, init);
const post = (
  body: unknown = activation,
  query = "",
  headers: Record<string, string> = { "content-type": "application/json" },
) =>
  request(base + query, {
    method: "POST",
    headers: { ...browserMutationHeaders(), ...headers },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.command.mockResolvedValue({ receipt, replayed: false });
  state.dashboard.mockResolvedValue({ subscription });
  state.history.mockResolvedValue({ receipts: [] });
  state.estimate.mockResolvedValue({});
  state.detail.mockResolvedValue({ receipt, current: subscription, observedAt: date });
});
it("requires authentication before every private subscription operation", async () => {
  state.actor = null;
  for (const handler of [dashboard, estimate, history, detail, download])
    expect((await handler(request(base), context)).status).toBe(401);
  expect((await POST(post())).status).toBe(401);
  expect(state.command).not.toHaveBeenCalled();
});
it("binds actor identity and accepts only validated activation/cancellation commands", async () => {
  const res = await POST(post({ ...activation, organizationId: "org_a" }));
  expect(res.status).toBe(200);
  expect(state.command).toHaveBeenCalledWith("usr_a", { ...activation, organizationId: "org_a" });
  expect((await POST(post(cancellation))).status).toBe(200);
  for (const key of ["actorId", "subjectId", "price", "status", "terms", "expiresAt", "paymentId"])
    expect((await POST(post({ ...activation, [key]: "bad" }))).status).toBe(400);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("vary")).toBe("Cookie");
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
});
it("refuses cross-site writes, oversized bodies and ambiguous parameters", async () => {
  expect(
    (
      await POST(
        post(activation, "", {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      )
    ).status,
  ).toBe(403);
  expect((await POST(post(activation, "", { "content-type": "text/plain" }))).status).toBe(415);
  expect((await POST(post({ ...activation, reason: "x".repeat(5000) }))).status).toBe(413);
  expect((await POST(post(activation, "?organizationId=org_a"))).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("rate limits reads and writes before database work", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await dashboard(request(base))).status).toBe(429);
  expect((await POST(post())).status).toBe(429);
  expect(state.dashboard).not.toHaveBeenCalled();
  expect(state.command).not.toHaveBeenCalled();
});
it("bounds scoped history and rejects identity overrides", async () => {
  expect(
    (await history(request(`${base}/history?organizationId=org_a&page=2&days=90`))).status,
  ).toBe(200);
  expect(state.history).toHaveBeenCalledWith("usr_a", "org_a", 2, 90);
  for (const [handler, path] of [
    [dashboard, base],
    [history, `${base}/history`],
    [detail, `${base}/receipts/${receipt.id}`],
    [download, `${base}/receipts/${receipt.id}/export`],
  ] as const)
    expect((await handler(request(`${path}?actorId=other`), context)).status).toBe(400);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
});
it("validates estimate amount/currency and keeps financial scope server-authorized", async () => {
  expect(
    (await estimate(request(`${base}/estimate?amount=10000&currency=RUB&organizationId=org_a`)))
      .status,
  ).toBe(200);
  expect(state.estimate).toHaveBeenCalledWith("usr_a", "org_a", 10000, "RUB");
  expect((await estimate(request(`${base}/estimate?amount=-1&currency=RUB`))).status).toBe(400);
  expect(
    (await estimate(request(`${base}/estimate?amount=1&currency=RUB&commissionBps=0`))).status,
  ).toBe(400);
});
it("serves bounded private JSON receipts only while account authority is retained", async () => {
  const res = await download(
    request(`${base}/receipts/${receipt.id}/export?organizationId=org_a`),
    context,
  );
  expect(res.status).toBe(200);
  expect(state.detail).toHaveBeenCalledWith("usr_a", receipt.id, "org_a");
  expect(res.headers.get("content-disposition")).toContain(receipt.id);
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await res.json()).toEqual(
    JSON.parse(
      JSON.stringify({
        format: "nexus-subscription-receipt-v1",
        receipt,
        current: subscription,
        observedAt: date,
      }),
    ),
  );
  state.detail.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  const denied = await download(request(base), context);
  expect(denied.status).toBe(404);
  expect(await denied.json()).toEqual({ code: "NOT_FOUND" });
});
it("returns domain conflicts without claiming activation or exposing internals", async () => {
  state.command.mockRejectedValue(
    new AppError("Provider required", 409, "SUBSCRIPTION_PAYMENT_REQUIRED"),
  );
  const res = await POST(post());
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ code: "SUBSCRIPTION_PAYMENT_REQUIRED" });
});
it("bounds exported bytes", async () => {
  state.detail.mockResolvedValue({ receipt: { ...receipt, description: "x".repeat(40 * 1024) } });
  expect((await download(request(base), context)).status).toBe(409);
});

afterEach(() => {
  vi.unstubAllEnvs();
});
