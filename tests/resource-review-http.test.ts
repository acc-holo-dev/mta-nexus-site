import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  ip: "unknown",
  command: vi.fn(),
  ownPage: vi.fn(),
  ownDetail: vi.fn(),
  publicPage: vi.fn(),
  report: vi.fn(),
  reportsPage: vi.fn(),
  reportDetail: vi.fn(),
  decide: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => state.ip }));
vi.mock("@nexus/security", () => ({
  generateId: (prefix: string) => `${prefix}_generated`,
  consumeRateLimit: async (...args: unknown[]) => {
    state.rate(...args);
    return { success: state.allowed };
  },
}));
vi.mock("@nexus/db", () => ({
  resourceReviewsRepository: {
    command: state.command,
    ownPage: state.ownPage,
    ownDetail: state.ownDetail,
    publicPage: state.publicPage,
    report: state.report,
    reportsPage: state.reportsPage,
    reportDetail: state.reportDetail,
    decide: state.decide,
  },
}));
import {
  GET as publicPage,
  POST as create,
} from "../apps/web/src/app/api/products/[id]/reviews/route";
import { GET as ownPage } from "../apps/web/src/app/api/library/reviews/route";
import { GET as ownDetail, POST as edit } from "../apps/web/src/app/api/library/review/[id]/route";
import { POST as report } from "../apps/web/src/app/api/products/[id]/reviews/[reviewId]/report/route";
import { GET as reportsPage } from "../apps/web/src/app/api/review-reports/route";
import { GET as reportDetail } from "../apps/web/src/app/api/review-reports/[id]/route";
import { GET as queue } from "../apps/web/src/app/api/admin/commerce/reviews/route";
import {
  GET as caseDetail,
  POST as decide,
} from "../apps/web/src/app/api/admin/commerce/reviews/[id]/route";
const context = { params: Promise.resolve({ id: "prd_a", reviewId: "cmt_a" }) };
const request = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://nexus.test${url}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { ...browserMutationHeaders(), "Content-Type": "application/json", ...headers },
  });
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.allowed = true;
  state.ip = "unknown";
  for (const fn of [
    state.command,
    state.ownPage,
    state.ownDetail,
    state.publicPage,
    state.report,
    state.reportsPage,
    state.reportDetail,
    state.decide,
  ])
    fn.mockReset().mockResolvedValue({});
});
it.each([
  ownPage,
  (r: NextRequest) => ownDetail(r, context),
  reportsPage,
  (r: NextRequest) => reportDetail(r, context),
  queue,
  (r: NextRequest) => caseDetail(r, context),
])("requires authentication for private reads", async (route) => {
  state.actor = null;
  const response = await route(request("/api/library/reviews"));
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
});
it("scopes private pages to the session and validates filters before database reads", async () => {
  const response = await ownPage(request("/api/library/reviews?page=2"));
  expect(response.status).toBe(200);
  expect(state.ownPage).toHaveBeenCalledWith("usr_a", 2);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect((await ownPage(request("/api/library/reviews?userId=other"))).status).toBe(400);
  expect(state.ownPage).toHaveBeenCalledTimes(1);
  await reportsPage(request("/api/review-reports?page=2&view=history"));
  expect(state.reportsPage).toHaveBeenCalledWith({ actorId: "usr_a", staff: false }, 2, "history");
});
it("uses safe public projections without a session or shared cache", async () => {
  state.actor = null;
  state.publicPage.mockResolvedValue({
    reviews: [{ text: "Useful", author: { username: "alice" } }],
    page: 1,
    totalPages: 1,
  });
  const response = await publicPage(request("/api/products/prd_a/reviews"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(state.publicPage).toHaveBeenCalledWith("prd_a", 1);
});
it("limits a verified client address and never trusts unknown shared address", async () => {
  state.ip = "203.0.113.5";
  state.allowed = false;
  expect((await publicPage(request("/api/products/prd_a/reviews"), context)).status).toBe(429);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "review-ip:203.0.113.5");
  expect(state.publicPage).not.toHaveBeenCalled();
});
it.each([
  null,
  { rating: 5, text: "" },
  { rating: 6, text: "Useful" },
  { rating: 5, text: "Useful", isVerifiedPurchase: true },
])("rejects invalid review %s without writing", async (body) => {
  expect((await create(request("/api/products/prd_a/reviews", body), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("writes only the authenticated identity and uses the review submission limiter", async () => {
  state.command.mockResolvedValue({
    id: "cmt_generated",
    revision: 1,
    status: "published",
    ratingCount: 1,
    ratingAverage: 50,
    review: { id: "cmt_generated" },
  });
  const response = await create(
    request("/api/products/prd_a/reviews", { text: "Useful resource", rating: 5 }),
    context,
  );
  expect(response.status).toBe(201);
  expect(response.headers.get("X-Request-Id")).toBeTruthy();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(state.command).toHaveBeenCalledWith({
    actorId: "usr_a",
    productId: "prd_a",
    reviewId: "cmt_generated",
    auditId: "aud_generated",
    command: { action: "save", expectedRevision: 0, text: "Useful resource", rating: 5 },
  });
  expect(state.rate).toHaveBeenCalledWith("reviewSubmission", "usr_a");
});
it.each(["REVIEW_ACCESS_REQUIRED", "REVIEW_CHANGED", "REVIEW_MODERATED"])(
  "preserves transactional refusal %s without private detail",
  async (code) => {
    state.command.mockRejectedValue(
      new AppError("PRIVATE_GRANT", code === "REVIEW_ACCESS_REQUIRED" ? 403 : 409, code),
    );
    const response = await create(
      request("/api/products/prd_a/reviews", { text: "Useful", rating: 4 }),
      context,
    );
    expect(response.status).toBe(code === "REVIEW_ACCESS_REQUIRED" ? 403 : 409);
    expect(await response.json()).toEqual({ code });
  },
);
it("rejects cross-site form submissions, oversized JSON and excessive requests", async () => {
  const body = { action: "save", expectedRevision: 1, text: "Useful", rating: 4 };
  expect(
    (
      await edit(
        request("/api/library/review/prd_a", body, { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await edit(
        request("/api/library/review/prd_a", body, { "Content-Type": "text/plain" }),
        context,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await edit(
        request("/api/library/review/prd_a", { ...body, text: "a".repeat(17000) }),
        context,
      )
    ).status,
  ).toBe(413);
  state.allowed = false;
  expect((await edit(request("/api/library/review/prd_a", body), context)).status).toBe(429);
  expect(state.command).not.toHaveBeenCalled();
});
it("supports revision-checked withdrawal without caller author fields", async () => {
  const response = await edit(
    request("/api/library/review/prd_a", { action: "withdraw", expectedRevision: 3 }),
    context,
  );
  expect(response.status).toBe(200);
  expect(state.command.mock.calls[0][0].command).toEqual({
    action: "withdraw",
    expectedRevision: 3,
  });
});
it("submits review reports to the separate target contract", async () => {
  await report(
    request("/api/products/prd_a/reviews/cmt_a/report", {
      type: "spam",
      reason: "Repeated spam messages",
    }),
    context,
  );
  expect(state.report).toHaveBeenCalledWith({
    actorId: "usr_a",
    productId: "prd_a",
    reviewId: "cmt_a",
    id: "rpt_generated",
    auditId: "aud_generated",
    type: "spam",
    reason: "Repeated spam messages",
  });
});
it("rejects nonstaff queue reads and decisions before processing their body", async () => {
  expect((await queue(request("/api/admin/commerce/reviews"))).status).toBe(403);
  expect(
    (
      await decide(
        request("/api/admin/commerce/reviews/prd_a", { action: "remove_review" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(state.decide).not.toHaveBeenCalled();
  expect(state.reportsPage).not.toHaveBeenCalled();
});
it("requires current review evidence for removal and maintains moderation limiter", async () => {
  state.actor = { id: "usr_staff", role: "moderator" };
  const body = { action: "remove_review", expectedStatus: "open", notes: "Repeated spam" };
  expect((await decide(request("/api/admin/commerce/reviews/prd_a", body), context)).status).toBe(
    400,
  );
  expect(
    (
      await decide(
        request("/api/admin/commerce/reviews/prd_a", { ...body, expectedRevision: 2 }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.decide).toHaveBeenCalledWith({
    actorId: "usr_staff",
    id: "prd_a",
    auditId: "aud_generated",
    command: { ...body, expectedRevision: 2 },
  });
  expect(state.rate).toHaveBeenCalledWith("moderationAction", "usr_staff");
});
