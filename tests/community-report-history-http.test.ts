import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ session: vi.fn(), history: vi.fn(), rate: vi.fn() }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("@nexus/db", () => ({ communityReportsRepository: { history: mock.history } }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mock.rate,
  can: (actor: { role: string }) => ["moderator", "admin"].includes(actor.role),
}));

import { GET as staffExport } from "../apps/web/src/app/api/admin/reports/[id]/history/export/route";
import { GET as staff } from "../apps/web/src/app/api/admin/reports/[id]/history/route";
import { GET as ownExport } from "../apps/web/src/app/api/workspace/reports/[id]/history/export/route";
import { GET as own } from "../apps/web/src/app/api/workspace/reports/[id]/history/route";
import { reportHistoryCopy } from "../apps/web/src/lib/community-report-history-copy";

const stamp = "2026-10-12T00:00:00.123456Z",
  actor = { id: "owner", role: "user" },
  context = { params: Promise.resolve({ id: "report" }) };
const event = {
  id: "event",
  action: "report.review",
  createdAt: stamp,
  from: "open",
  to: "under_review",
  by: "staff",
  removed: false,
};
const value = {
  report: { id: "report", targetType: "comment", type: "abuse", status: "under_review" },
  audience: "requester",
  period: "all",
  group: "all",
  until: stamp,
  items: [event],
  hasMore: false,
  nextCursor: null,
};
const staffValue = {
  ...value,
  audience: "staff",
  items: [{ ...event, notes: "PRIVATE_DECISION_NOTE", batchSize: 2 }],
};
const request = (query = "", locale = "ru") =>
  new NextRequest(`https://nexus.test/api/workspace/reports/report/history${query}`, {
    headers: { cookie: `nexus_session=test;nexus_locale=${locale}` },
  });
const privateResponse = (r: Response) => {
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.headers.get("vary")).toBe("Cookie");
  expect(r.headers.get("x-request-id")).toBeTruthy();
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue(actor);
  mock.rate.mockResolvedValue({ success: true });
  mock.history.mockResolvedValue(value);
});
it("binds requester history to the authenticated actor and narrow report projection", async () => {
  const response = await own(request(), context);
  expect(response.status).toBe(200);
  privateResponse(response);
  expect(await response.json()).toEqual(value);
  expect(mock.history).toHaveBeenCalledExactlyOnceWith(
    { actorId: "owner", staff: false },
    "report",
    expect.objectContaining({ period: "all", group: "all", query: "" }),
  );
});
it("downloads the same requester page and rechecks access rather than returning cached staff material", async () => {
  const response = await ownExport(request(`?until=${stamp}`), context);
  expect(response.status).toBe(200);
  privateResponse(response);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="report-history.json"',
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.json()).toEqual(value);
  expect(mock.history.mock.calls[0][2].until).toBe(stamp);
});
it("allows staff notes only through the staff route with fresh repository authorization", async () => {
  expect((await staff(request(), context)).status).toBe(403);
  expect(mock.history).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ ...actor, role: "moderator" });
  mock.history.mockResolvedValue(staffValue);
  const response = await staffExport(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(staffValue);
  expect(mock.history).toHaveBeenLastCalledWith(
    { actorId: "owner", staff: true },
    "report",
    expect.anything(),
  );
  mock.history.mockRejectedValue(new AppError("revoked private identity", 403, "FORBIDDEN"));
  const revoked = await staffExport(request(), context);
  expect(revoked.status).toBe(403);
  expect(revoked.headers.get("content-disposition")).toBeNull();
  expect(await revoked.text()).not.toContain("private identity");
});
it.each([
  "?actorId=victim",
  "?staff=true",
  "?q=secret",
  "?group=all&group=review",
  "?period=2",
  "?cursor=bad",
  "?until=9999",
  "?before=event",
])("rejects unsafe activity parameters before storage %s", async (query) => {
  const response = await own(request(query), context);
  expect(response.status).toBe(400);
  privateResponse(response);
  expect(mock.history).not.toHaveBeenCalled();
  expect((await response.json()).error).toBe(reportHistoryCopy("ru").invalid);
});
it("rejects anonymous requests, bad report IDs and exhausted read rates", async () => {
  mock.session.mockResolvedValue(null);
  expect((await own(request(), context)).status).toBe(401);
  mock.session.mockResolvedValue(actor);
  expect((await own(request(), { params: Promise.resolve({ id: "../secret" }) })).status).toBe(400);
  mock.rate.mockResolvedValue({ success: false });
  expect((await own(request(), context)).status).toBe(429);
  expect(mock.history).not.toHaveBeenCalled();
});
it.each(["ru", "en"] as const)(
  "keeps missing/expired history and unexpected failures private in %s",
  async (locale) => {
    mock.history.mockRejectedValue(new AppError("private anchor", 410, "REPORT_HISTORY_EXPIRED"));
    const response = await ownExport(request("", locale), context);
    expect(response.status).toBe(410);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect((await response.json()).error).toBe(reportHistoryCopy(locale).expired);
    mock.history.mockRejectedValue(new AppError("private reporter", 404, "NOT_FOUND"));
    expect((await own(request(), context)).status).toBe(404);
    mock.history.mockRejectedValue(new Error("SQL credential secret"));
    const failed = await own(request("", locale), context);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("credential");
  },
);
it.each([
  { items: [{ ...event, notes: "LEAK" }] },
  { audience: "staff", items: [{ ...event, notes: "LEAK", batchSize: 2 }] },
  { report: { ...value.report, id: "other" } },
  { group: "review" },
  { items: Array(21).fill(event) },
  { items: [{ ...event, from: "unsupported" }] },
  { items: [{ ...event, createdAt: "invalid" }] },
  { raw: { email: "LEAK" } },
])("fails closed on corrupt scope or accidental private fields %j", async (extra) => {
  mock.history.mockResolvedValue({ ...value, ...extra });
  const response = await ownExport(request(), context);
  expect(response.status).toBe(503);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(await response.text()).not.toMatch(/LEAK|Zod/u);
});
it("encodes only the narrow cursor fields and validates the last-row/cutoff agreement", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...event, id: `event-${i}` }));
  const cursor = {
    version: 1,
    context: "a".repeat(64),
    until: stamp,
    id: "event-19",
    raw: "SECRET_CURSOR",
  };
  mock.history.mockResolvedValue({ ...value, items: rows, hasMore: true, nextCursor: cursor });
  const response = await own(request(), context);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(JSON.parse(Buffer.from(body.nextCursor, "base64url").toString())).not.toHaveProperty(
    "raw",
  );
  mock.history.mockResolvedValue({
    ...value,
    items: rows,
    hasMore: true,
    nextCursor: { ...cursor, id: "other" },
  });
  expect((await own(request(), context)).status).toBe(503);
});
