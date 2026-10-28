import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  save: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/db", () => ({
  planReviewsRepository: { save: state.save, page: state.page, detail: state.detail },
  sellerSalesRepository: {},
  commercialPlanRepository: {},
}));

import { GET as download } from "../apps/web/src/app/api/subscriptions/reviews/[id]/export/route";
import { GET as detail } from "../apps/web/src/app/api/subscriptions/reviews/[id]/route";
import { GET as history, POST } from "../apps/web/src/app/api/subscriptions/reviews/route";

const base = "/api/subscriptions/reviews",
  context = { params: Promise.resolve({ id: "prev_a" }) };
const command = {
  requestId: "11111111-1111-4111-8111-111111111111",
  planId: "cplan_a",
  expectedRevision: 2,
  grossAmount: 10000,
  currency: "RUB",
};
const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://nexus.test${path}`, init);
const post = (
  body: unknown = command,
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
  state.save.mockResolvedValue({ review: { id: "prev_a" }, replayed: false });
  state.page.mockResolvedValue({ reviews: [] });
  state.detail.mockResolvedValue({ review: { id: "prev_a" } });
});
it("requires a signed-in session for all review surfaces", async () => {
  state.actor = null;
  for (const handler of [history, detail, download])
    expect((await handler(request(base), context)).status).toBe(401);
  expect((await POST(post())).status).toBe(401);
  expect(state.save).not.toHaveBeenCalled();
});
it("fixes actor identity and validates request bodies before repository writes", async () => {
  const res = await POST(post({ ...command, organizationId: "org_a" }));
  expect(res.status).toBe(200);
  expect(state.save).toHaveBeenCalledWith("usr_a", { ...command, organizationId: "org_a" });
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(state.rate).toHaveBeenCalledWith("reviewSubmission", "usr_a");
  for (const body of [
    { ...command, actorId: "usr_other" },
    { ...command, grossAmount: -1 },
    { ...command, terms: {} },
  ])
    expect((await POST(post(body))).status).toBe(400);
});
it("blocks cross-site, wrong content types, oversized bodies and ambiguous POST queries", async () => {
  expect(
    (
      await POST(
        post(command, "", { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
      )
    ).status,
  ).toBe(403);
  expect((await POST(post(command, "", { "content-type": "text/plain" }))).status).toBe(415);
  expect((await POST(post({ ...command, padding: "a".repeat(5000) }))).status).toBe(413);
  expect((await POST(post(command, "?organizationId=org_other"))).status).toBe(400);
  expect(state.save).not.toHaveBeenCalled();
});
it("applies bounded private history and live detail scope with inspection limits", async () => {
  const res = await history(request(`${base}?organizationId=org_a&days=30&page=2`));
  expect(res.status).toBe(200);
  expect(state.page).toHaveBeenCalledWith("usr_a", "org_a", 2, 30);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  await detail(request(`${base}/prev_a?organizationId=org_a`), context);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "prev_a", "org_a");
});
it("refuses identity selectors, duplicate queries and unsafe paths before repository access", async () => {
  for (const q of [
    "actorId=other",
    "organizationId=org_a&organizationId=org_b",
    "pageSize=100",
    "days=31",
  ])
    expect((await history(request(`${base}?${q}`))).status).toBe(400);
  expect(
    (await detail(request(base), { params: Promise.resolve({ id: "../private" }) })).status,
  ).toBe(400);
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("rate limits inspection and mutation before accessing commerce", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await history(request(base))).status).toBe(429);
  expect((await POST(post())).status).toBe(429);
  expect(state.save).not.toHaveBeenCalled();
  expect(state.page).not.toHaveBeenCalled();
});
it("exports bounded JSON with private headers and masks private repository failures", async () => {
  const res = await download(request(`${base}/prev_a/export`), context);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-disposition")).toContain("attachment");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("vary")).toBe("Cookie");
  state.detail.mockRejectedValue(new AppError("PRIVATE_DETAIL", 404, "NOT_FOUND"));
  expect(await (await download(request(base), context)).json()).toEqual({ code: "NOT_FOUND" });
});

it("refuses oversized detail exports without exposing report data", async () => {
  state.detail.mockResolvedValue({ review: { id: "prev_a", padding: "a".repeat(32768) } });
  const response = await download(request(base), context);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ code: "RESOURCE_COMMERCE_FAILED" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
