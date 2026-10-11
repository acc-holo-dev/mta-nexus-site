import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  desk: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/author-content-service", () => ({
  authorContentService: { desk: state.desk, history: state.history, restore: state.restore },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import { GET as history } from "../apps/web/src/app/api/workspace/content/[id]/history/route";
import { POST as restore } from "../apps/web/src/app/api/workspace/content/[id]/restore/route";
import { GET as desk } from "../apps/web/src/app/api/workspace/content/desk/route";

const params = { params: Promise.resolve({ id: "article" }) },
  revision = "2026-10-11T00:00:00.123456Z";
const request = (
  method = "GET",
  query = "",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://nexus.test/api/workspace/content/desk${query}`, {
    method,
    headers: {
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.session.mockResolvedValue({ id: "actor" });
  state.rate.mockResolvedValue({ success: true });
  state.desk.mockResolvedValue({ items: [], olderCursor: null, newerCursor: null });
  state.history.mockResolvedValue({});
  state.restore.mockResolvedValue({ id: "article", status: "draft", revision });
});
it("keeps the authenticated author desk private and passes normalized filters", async () => {
  const response = await desk(
    request("GET", "?q=word&status=archived&type=article&source=personal"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.desk).toHaveBeenCalledWith(
    { id: "actor" },
    expect.objectContaining({
      query: "word",
      status: "archived",
      type: "article",
      source: "personal",
    }),
  );
});
it.each(["desk", "history", "restore"])("requires a session for %s", async (target) => {
  state.session.mockResolvedValue(null);
  const response =
    target === "desk"
      ? await desk(request())
      : target === "history"
        ? await history(request(), params)
        : await restore(request("POST", "", { expectedRevision: revision }), params);
  expect(response.status).toBe(401);
  expect(state.desk).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
  expect(state.restore).not.toHaveBeenCalled();
});
it.each(["?type=resource", "?status=bad", "?q=one&q=two", "?actorId=foreign", "?page=9999"])(
  "rejects desk filter injection %s",
  async (query) => {
    expect((await desk(request("GET", query))).status).toBe(400);
    expect(state.desk).not.toHaveBeenCalled();
  },
);
it("rejects a malformed history cursor before storage", async () => {
  expect((await history(request("GET", "?cursor=bad"), params)).status).toBe(400);
  expect(state.history).not.toHaveBeenCalled();
});
it("uses a bounded JSON author command and rejects cross-site updates", async () => {
  const response = await restore(request("POST", "", { expectedRevision: revision }), params);
  expect(response.status).toBe(200);
  expect(state.restore).toHaveBeenCalledWith(
    "article",
    { expectedRevision: revision },
    { id: "actor" },
  );
  state.restore.mockClear();
  expect(
    (
      await restore(
        request("POST", "", { expectedRevision: revision }, { "sec-fetch-site": "cross-site" }),
        params,
      )
    ).status,
  ).toBe(403);
  expect(state.restore).not.toHaveBeenCalled();
});
it("requires JSON, no query parameters and a real byte ceiling", async () => {
  expect(
    (await restore(request("POST", "", {}, { "content-type": "text/plain" }), params)).status,
  ).toBe(415);
  expect((await restore(request("POST", "?status=published", {}), params)).status).toBe(400);
  expect((await restore(request("POST", "", { data: "x".repeat(1025) }), params)).status).toBe(413);
  expect(state.restore).not.toHaveBeenCalled();
});
it.each([
  [409, "CONFLICT"],
  [403, "PUBLICATION_RESTORE_DENIED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
])("localizes restore failure %s/%s without internal details", async (status, code) => {
  state.restore.mockRejectedValue(new AppError("PRIVATE_SQL", status, code));
  const response = await restore(request("POST", "", { expectedRevision: revision }), params);
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain("PRIVATE_SQL");
});
it.each(["desk", "history", "restore"])(
  "rate limits %s without querying the publication",
  async (target) => {
    state.rate.mockResolvedValue({ success: false });
    const response =
      target === "desk"
        ? await desk(request())
        : target === "history"
          ? await history(request(), params)
          : await restore(request("POST", "", { expectedRevision: revision }), params);
    expect(response.status).toBe(429);
    expect(state.desk).not.toHaveBeenCalled();
    expect(state.history).not.toHaveBeenCalled();
    expect(state.restore).not.toHaveBeenCalled();
  },
);
it("returns a recoverable failure without a fake empty desk", async () => {
  state.desk.mockRejectedValue(new Error("PRIVATE_SQL"));
  const response = await desk(request());
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).not.toContain("PRIVATE_SQL");
  expect(body).not.toContain("items");
});
