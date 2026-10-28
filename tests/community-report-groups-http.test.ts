import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  groups: vi.fn(),
  publicationReports: vi.fn(),
  previewPublicationBatch: vi.fn(),
  decidePublicationBatch: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mock.rate,
  can: (actor: { role: string }) => actor.role === "moderator" || actor.role === "admin",
  generateId: (prefix: string) => `${prefix}_${Math.random().toString(16).slice(2)}`,
}));
vi.mock("@nexus/db", () => ({
  communityReportsRepository: {
    groups: mock.groups,
    publicationReports: mock.publicationReports,
    previewPublicationBatch: mock.previewPublicationBatch,
    decidePublicationBatch: mock.decidePublicationBatch,
  },
}));

import { POST as preview } from "../apps/web/src/app/api/admin/community/[id]/reports/batch/preview/route";
import { POST as commit } from "../apps/web/src/app/api/admin/community/[id]/reports/batch/route";
import { GET as reports } from "../apps/web/src/app/api/admin/community/[id]/reports/route";
import { GET as groups } from "../apps/web/src/app/api/admin/reports/targets/route";

const stamp = "2026-10-12T00:00:00.123456Z",
  context = { params: Promise.resolve({ id: "post" }) },
  input = {
    items: [{ id: "report", expectedStatus: "open" }],
    action: "resolve",
    notes: " Recorded reason ",
  };
const group = {
  targetType: "content",
  targetId: "post",
  anchorId: "report",
  firstAt: stamp,
  lastAt: stamp,
  open: 1,
  review: 0,
  resolved: 0,
  dismissed: 0,
  target: { contentId: "post", title: "Title", status: "published", text: null },
};
const groupValue = {
  period: "30",
  view: "pending",
  query: "",
  target: null,
  type: null,
  until: stamp,
  items: [group],
  hasMore: false,
  nextCursor: null,
};
const publication = {
  id: "post",
  title: "Title",
  status: "published",
  text: "Body",
  truncated: false,
};
const report = {
  id: "report",
  type: "abuse",
  reason: "Reason",
  status: "open",
  createdAt: new Date(stamp),
  resolvedAt: null,
};
const review = {
  contentId: "post",
  commentId: null,
  publication: { ...publication, digest: "PRIVATE_DIGEST" },
  comment: null,
  action: "resolve",
  notes: "Recorded reason",
  previewRevision: "a".repeat(64),
  items: [
    {
      id: "report",
      type: "abuse",
      reason: "Reason",
      createdAt: new Date(stamp),
      before: "open",
      after: "resolved",
    },
  ],
};
function request(method = "GET", body?: unknown, query = "", headers: Record<string, string> = {}) {
  return new NextRequest(`https://nexus.test/api/admin/reports/targets${query}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ id: "staff", role: "moderator" });
  mock.rate.mockResolvedValue({ success: true });
  mock.groups.mockResolvedValue(groupValue);
  mock.publicationReports.mockResolvedValue({
    publication,
    items: [report],
    hasMore: false,
    page: 1,
    view: "pending",
  });
  mock.previewPublicationBatch.mockResolvedValue(review);
  mock.decidePublicationBatch.mockResolvedValue({
    contentId: "post",
    commentId: null,
    action: "resolve",
    previewRevision: "a".repeat(64),
    items: [{ id: "report", status: "resolved", reporterId: "PRIVATE_REPORTER" }],
  });
});
it("forces current staff group scope, validates counts and excludes private repository extras", async () => {
  mock.groups.mockResolvedValue({
    ...groupValue,
    private: "PRIVATE_RAW",
    items: [{ ...group, reporterId: "PRIVATE_ID", notes: "PRIVATE_NOTE" }],
  });
  const response = await groups(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  const body = await response.json();
  expect(body.items[0].reportHref).toBe("/admin/reports/report");
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE_|anchorId/u);
  expect(mock.groups).toHaveBeenCalledWith(
    "staff",
    expect.objectContaining({ view: "pending", period: "30" }),
  );
});
it("gates anonymous/nonstaff users, malformed filters, exhausted search and revoked current staff", async () => {
  mock.session.mockResolvedValue(null);
  expect((await groups(request())).status).toBe(401);
  mock.session.mockResolvedValue({ id: "staff", role: "user" });
  expect((await groups(request())).status).toBe(403);
  mock.session.mockResolvedValue({ id: "staff", role: "moderator" });
  expect((await groups(request("GET", undefined, "?view=pending&view=history"))).status).toBe(400);
  mock.rate.mockResolvedValue({ success: false });
  expect((await groups(request())).status).toBe(429);
  expect(mock.groups).not.toHaveBeenCalled();
  mock.rate.mockResolvedValue({ success: true });
  mock.groups.mockRejectedValue(new AppError("private role", 403, "FORBIDDEN"));
  expect((await groups(request())).status).toBe(403);
});
it.each([
  { period: "all" },
  { query: "drift" },
  { items: [{ ...group, open: -1 }] },
  { items: Array(21).fill(group) },
  { items: [{ ...group, firstAt: "invalid" }] },
  { items: [{ ...group, target: { ...group.target, actorId: "PRIVATE" } }] },
])("fails closed on corrupt group storage output %j", async (extra) => {
  mock.groups.mockResolvedValue({ ...groupValue, ...extra });
  expect((await groups(request())).status).toBe(503);
});
it("returns bounded publication context and current reports with no staff/account extras", async () => {
  expect((await reports(request(), context)).status).toBe(200);
  expect(mock.publicationReports).toHaveBeenCalledWith("staff", "post", {
    view: "pending",
    page: 1,
    type: undefined,
    query: "",
  });
  expect((await reports(request("GET", undefined, "?target=comment"), context)).status).toBe(400);
  mock.publicationReports.mockResolvedValue({
    publication: { ...publication, id: "foreign" },
    items: [],
    hasMore: false,
    page: 1,
    view: "pending",
  });
  expect((await reports(request(), context)).status).toBe(503);
});
it("previews a normalized publication decision and hides its full private digest", async () => {
  const response = await preview(request("POST", input), context);
  expect(response.status).toBe(200);
  expect((await response.json()).publication).toEqual(publication);
  expect(mock.previewPublicationBatch).toHaveBeenCalledWith("staff", "post", {
    ...input,
    notes: "Recorded reason",
  });
  expect(mock.decidePublicationBatch).not.toHaveBeenCalled();
});
it("confirms scoped publication batches without leaking reporter fields", async () => {
  const command = { ...input, previewRevision: "a".repeat(64) },
    response = await commit(request("POST", command), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    contentId: "post",
    commentId: null,
    action: "resolve",
    previewRevision: "a".repeat(64),
    items: [{ id: "report", status: "resolved" }],
  });
  mock.decidePublicationBatch.mockRejectedValue(
    new AppError("private text", 409, "REPORT_BATCH_CHANGED"),
  );
  expect((await commit(request("POST", command), context)).status).toBe(409);
});
it("requires bounded same-site JSON and rejects unknown fields or mutation query parameters", async () => {
  for (const [headers, body, query, status] of [
    [{ "sec-fetch-site": "cross-site" }, input, "", 403],
    [{ "content-type": "text/plain" }, input, "", 415],
    [{}, { ...input, notes: "x".repeat(9000) }, "", 413],
    [{}, { ...input, reporterId: "victim" }, "", 400],
    [{}, input, "?view=pending", 400],
  ] as const)
    expect((await preview(request("POST", body, query, headers), context)).status).toBe(status);
  expect(mock.previewPublicationBatch).not.toHaveBeenCalled();
});
