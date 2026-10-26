import { NextRequest } from "next/server";
import { AppError, NotFoundError } from "@nexus/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  libraryPage: vi.fn(),
  libraryDetail: vi.fn(),
  libraryCommand: vi.fn(),
  staffPage: vi.fn(),
  staffDetail: vi.fn(),
  staffCommand: vi.fn(),
  publisher: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/db", () => ({
  resourceLibrarySelectionsRepository: {
    page: state.libraryPage,
    detail: state.libraryDetail,
    command: state.libraryCommand,
  },
  resourceModerationRepository: {
    page: state.staffPage,
    detail: state.staffDetail,
    command: state.staffCommand,
    publisherHistory: state.publisher,
  },
}));
vi.mock("@nexus/security", () => ({
  generateId: () => "aud_a",
  consumeRateLimit: async (...args: unknown[]) => {
    state.rate(...args);
    return { success: state.allowed };
  },
}));
import { GET as libraryPage } from "../apps/web/src/app/api/library/releases/route";
import {
  GET as libraryDetail,
  POST as select,
} from "../apps/web/src/app/api/library/releases/[id]/route";
import { GET as staffPage } from "../apps/web/src/app/api/admin/resources/route";
import {
  GET as staffDetail,
  POST as moderate,
} from "../apps/web/src/app/api/admin/resources/[id]/route";
import { GET as publisher } from "../apps/web/src/app/api/products/[id]/moderation/route";
const context = { params: Promise.resolve({ id: "prd_a" }) },
  fixed = { mode: "fixed", expectedRevision: 0, buildId: "bld_a" };
const decision = {
  action: "release",
  expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
  reason: "Reviewed evidence",
};
function get(path: string) {
  return new NextRequest(`https://nexus.test${path}`);
}
function post(path: string, body: unknown, headers = {}) {
  return new NextRequest(`https://nexus.test${path}`, {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
function privateResponse(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.allowed = true;
  for (const fn of [
    state.libraryPage,
    state.libraryDetail,
    state.libraryCommand,
    state.staffPage,
    state.staffDetail,
    state.staffCommand,
    state.publisher,
  ])
    fn.mockReset().mockResolvedValue({});
});
it.each([
  libraryPage,
  staffPage,
  (r: NextRequest) => libraryDetail(r, context),
  (r: NextRequest) => staffDetail(r, context),
  (r: NextRequest) => publisher(r, context),
])("authenticates private reads before querying any data", async (route) => {
  state.user = null;
  const response = await route(get("/api/library/releases"));
  expect(response.status).toBe(401);
  privateResponse(response);
  expect(state.libraryPage).not.toHaveBeenCalled();
  expect(state.staffPage).not.toHaveBeenCalled();
});
it("binds library reads and selections exclusively to the session buyer", async () => {
  await libraryPage(get("/api/library/releases?filter=updates&page=2"));
  expect(state.libraryPage).toHaveBeenCalledWith("usr_a", 2, "updates");
  const response = await select(post("/api/library/releases/prd_a", fixed), context);
  expect(response.status).toBe(200);
  privateResponse(response);
  expect(state.libraryCommand).toHaveBeenCalledWith({
    userId: "usr_a",
    productId: "prd_a",
    command: fixed,
    auditId: "aud_a",
  });
});
it.each(["?userId=another", "?page=1&page=2", "?filter=private"])(
  "rejects library query manipulation %s",
  async (query) => {
    expect((await libraryPage(get(`/api/library/releases${query}`))).status).toBe(400);
    expect(state.libraryPage).not.toHaveBeenCalled();
  },
);
it.each([{ "sec-fetch-site": "cross-site" }, { "content-type": "text/plain" }])(
  "rejects unsafe mutation transport %j",
  async (headers) => {
    expect(
      (await select(post("/api/library/releases/prd_a", fixed, headers), context)).status,
    ).toBeGreaterThanOrEqual(400);
    expect(state.libraryCommand).not.toHaveBeenCalled();
  },
);
it("bounds the streamed selection body and rejects injected authority", async () => {
  expect(
    (
      await select(
        post("/api/library/releases/prd_a", { ...fixed, extra: "x".repeat(3000) }),
        context,
      )
    ).status,
  ).toBe(413);
  expect(
    (await select(post("/api/library/releases/prd_a", { ...fixed, userId: "another" }), context))
      .status,
  ).toBe(400);
  expect(state.libraryCommand).not.toHaveBeenCalled();
});
it("rate limits both private reads and writes", async () => {
  state.allowed = false;
  for (const response of [
    await libraryPage(get("/api/library/releases")),
    await select(post("/api/library/releases/prd_a", fixed), context),
  ]) {
    expect(response.status).toBe(429);
    privateResponse(response);
  }
  expect(state.libraryPage).not.toHaveBeenCalled();
  expect(state.libraryCommand).not.toHaveBeenCalled();
});
it("a publisher cannot enter the staff queue or lift a suspension", async () => {
  expect((await staffPage(get("/api/admin/resources"))).status).toBe(403);
  expect((await moderate(post("/api/admin/resources/prd_a", decision), context)).status).toBe(403);
  expect(state.staffPage).not.toHaveBeenCalled();
  expect(state.staffCommand).not.toHaveBeenCalled();
});
it("routes moderator commands through the repository's live authority check", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  state.staffCommand.mockRejectedValue(new AppError("Private internal detail", 403, "FORBIDDEN"));
  const response = await moderate(post("/api/admin/resources/prd_a", decision), context);
  expect(state.staffCommand).toHaveBeenCalledWith({
    actorId: "usr_a",
    productId: "prd_a",
    command: decision,
    auditId: "aud_a",
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ code: "FORBIDDEN" });
  privateResponse(response);
  expect(state.rate).toHaveBeenCalledWith("moderationAction", "usr_a");
});
it("exposes scoped publisher history and masks a revoked buyer grant as missing", async () => {
  await publisher(get("/api/products/prd_a/moderation?page=2"), context);
  expect(state.publisher).toHaveBeenCalledWith("usr_a", "prd_a", 2);
  state.libraryDetail.mockRejectedValue(new NotFoundError("Library resource", "prd_a"));
  const response = await libraryDetail(get("/api/library/releases/prd_a"), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
  privateResponse(response);
});
it("requires the current moderation revision and a bounded reason", async () => {
  state.user = { id: "usr_a", role: "admin" };
  for (const value of [
    { ...decision, reason: "" },
    { ...decision, expectedUpdatedAt: "invalid" },
    { ...decision, status: "published" },
  ])
    expect((await moderate(post("/api/admin/resources/prd_a", value), context)).status).toBe(400);
  expect(state.staffCommand).not.toHaveBeenCalled();
});

it.each(["?userId=other", "?page=1", "?mode=latest", "?buildId=bld_other&buildId=bld_a"])(
  "rejects selection query injection %s",
  async (query) => {
    const response = await select(post(`/api/library/releases/prd_a${query}`, fixed), context);
    expect(response.status).toBe(400);
    privateResponse(response);
    expect(state.libraryCommand).not.toHaveBeenCalled();
  },
);

it("passes the reviewed artifact through the session-bound selection endpoint", async () => {
  const command = {
    ...fixed,
    reviewedArtifact: { sha256Hash: "a".repeat(64), fileSizeBytes: 100 },
  };
  const response = await select(post("/api/library/releases/prd_a", command), context);
  expect(response.status).toBe(200);
  expect(state.libraryCommand).toHaveBeenCalledWith({
    userId: "usr_a",
    productId: "prd_a",
    command,
    auditId: "aud_a",
  });
  privateResponse(response);
});
