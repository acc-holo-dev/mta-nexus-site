import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  submit: vi.fn(),
  decide: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/community-report-service", () => ({
  communityReportService: mocks,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));

import { PATCH, GET as staffDetail } from "../apps/web/src/app/api/admin/reports/[id]/route";
import { GET as staffList } from "../apps/web/src/app/api/admin/reports/route";
import { GET as ownDetail } from "../apps/web/src/app/api/workspace/reports/[id]/route";
import { GET as ownList, POST } from "../apps/web/src/app/api/workspace/reports/route";

const actor = { id: "actor", role: "user" },
  context = { params: Promise.resolve({ id: "report" }) };
const report = {
  targetType: "comment",
  targetId: "comment",
  type: "abuse",
  reason: " Abuse details ",
};
const decision = {
  action: "remove_comment",
  expectedStatus: "open",
  expectedRevision: "a".repeat(64),
  notes: " Spam ",
};
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api/workspace/reports${query}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.page.mockResolvedValue({ items: [], hasMore: false });
  mocks.detail.mockResolvedValue({ id: "report" });
  mocks.submit.mockResolvedValue({
    id: "report",
    created: true,
    targetType: "comment",
    targetId: "comment",
  });
  mocks.decide.mockResolvedValue({
    id: "report",
    status: "resolved",
    action: "remove_comment",
    reporterId: "reporter",
    removed: true,
  });
});
it("forces owner/staff scope server-side and uses private responses for list and details", async () => {
  const response = await ownList(
    request("GET", undefined, "?target=comment&page=2&view=history&type=spam"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.page).toHaveBeenCalledWith(actor, {
    target: "comment",
    page: 2,
    view: "history",
    type: "spam",
  });
  await staffList(request());
  expect(mocks.page.mock.calls.at(-1)?.[2]).toBe(true);
  await ownDetail(request(), context);
  expect(mocks.detail).toHaveBeenLastCalledWith(actor, "report");
  await staffDetail(request(), context);
  expect(mocks.detail).toHaveBeenLastCalledWith(actor, "report", true);
});
it("blocks anonymous access, forged actor scope and repeated filters", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await ownList(request())).status).toBe(401);
  expect((await PATCH(request("PATCH", decision), context)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  for (const query of ["?actorId=victim", "?page=1&page=2", "?target=product"])
    expect((await ownList(request("GET", undefined, query))).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("normalizes writes and returns the confirmed result for a new or duplicate report", async () => {
  expect((await POST(request("POST", report))).status).toBe(200);
  expect(mocks.submit).toHaveBeenCalledWith(actor, {
    ...report,
    reason: "Abuse details",
    evidenceUrls: [],
  });
  mocks.submit.mockResolvedValue({ id: "report", created: false });
  expect((await POST(request("POST", report))).status).toBe(200);
});
it("requires same-site JSON and bounded bodies for both mutations", async () => {
  for (const [headers, body, status] of [
    [{ "sec-fetch-site": "cross-site" }, report, 403],
    [{ "content-type": "text/plain" }, report, 415],
    [{}, { ...report, reason: "x".repeat(40000) }, 413],
  ] as const)
    expect((await POST(request("POST", body, "", headers))).status).toBe(status);
  expect(
    (await PATCH(request("PATCH", decision, "", { "sec-fetch-site": "cross-site" }), context))
      .status,
  ).toBe(403);
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it.each([
  { ...report, reporterId: "victim" },
  { ...report, targetType: "product" },
  { ...report, evidenceUrls: ["data:text/html,x"] },
])("rejects invalid reports before persistence %j", async (body) => {
  expect((await POST(request("POST", body))).status).toBe(400);
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("confirms moderation writes without leaking reporter identity or deferring a second outcome notice", async () => {
  const response = await PATCH(request("PATCH", decision), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id: "report",
    status: "resolved",
    action: "remove_comment",
    removed: true,
  });
  expect(mocks.decide).toHaveBeenCalledWith(actor, "report", { ...decision, notes: "Spam" });
});
it("propagates live authority, ownership and CAS errors without internal details or false notifications", async () => {
  for (const [code, status] of [
    ["FORBIDDEN", 403],
    ["COMMENT_CHANGED", 409],
    ["REPORT_STATE_CHANGED", 409],
    ["NOT_FOUND", 404],
  ] as const) {
    mocks.decide.mockRejectedValue(new AppError("private detail", status, code));
    const response = await PATCH(request("PATCH", decision), context);
    expect(response.status).toBe(status);
    expect((await response.json()).error).not.toContain("private detail");
  }
});
it("limits reads and writes before service work", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await ownList(request())).status).toBe(429);
  expect((await POST(request("POST", report))).status).toBe(429);
  expect((await PATCH(request("PATCH", decision), context)).status).toBe(429);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("preserves literal report searches and rejects duplicate or oversized queries", async () => {
  expect((await ownList(request("GET", undefined, "?q=100%25_"))).status).toBe(200);
  expect(mocks.page).toHaveBeenCalledWith(actor, expect.objectContaining({ query: "100%_" }));
  mocks.page.mockClear();
  for (const query of ["?q=x&q=y", `?q=${"x".repeat(81)}`])
    expect((await ownList(request("GET", undefined, query))).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("returns safe localized unavailable outcomes and rejects malformed detail IDs", async () => {
  mocks.submit.mockRejectedValue(new Error("secret SQL"));
  const response = await POST(request("POST", report));
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.error).toMatch(/подтвердить/u);
  expect(JSON.stringify(body)).not.toContain("secret SQL");
  expect((await ownDetail(request(), { params: Promise.resolve({ id: "a/b" }) })).status).toBe(400);
  expect(mocks.detail).not.toHaveBeenCalled();
});
