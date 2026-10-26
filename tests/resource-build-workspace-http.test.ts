import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rate: vi.fn(),
  detail: vi.fn(),
  command: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.auth },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  can: () => true,
  generateId: () => "aud_a",
}));
vi.mock("../apps/web/src/lib/services/resource-build-workspace-service", () => ({
  resourceBuildWorkspaceService: { detail: mocks.detail, command: mocks.command },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { reviewBuild: mocks.review },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));
vi.mock("../apps/web/src/lib/services/server-follow-notification-service", () => ({
  notifyServerFollowersOfPublishedContent: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  resourceModerationService: {},
}));
vi.mock("@nexus/db", () => ({
  productRepository: {},
  reportRepository: {},
  verificationRepository: {},
}));
import { GET, PATCH } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/route";
import { GET as staffGet } from "../apps/web/src/app/api/admin/resources/[id]/builds/[buildId]/route";
import { POST as moderate } from "../apps/web/src/app/api/admin/actions/route";
const actor = { id: "usr_a", role: "developer" },
  params = { params: Promise.resolve({ id: "prd_a", buildId: "bld_a" }) };
const command = { action: "withdraw", expectedRevision: 3, reason: " Fix notes " };
function req(
  body: unknown = command,
  headers: Record<string, string> = {},
  url = "/api/products/prd_a/builds/bld_a",
  method = "PATCH",
) {
  return new NextRequest(`http://nexus.test${url}`, {
    method,
    headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.command.mockResolvedValue({ id: "bld_a", status: "draft", revision: 4 });
});
it("authenticates before parsing commands", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await PATCH(req(), params);
  expect(response.status).toBe(401);
  expect(mocks.command).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
});
it("passes only strict, trimmed commands to the guarded service", async () => {
  const response = await PATCH(req(), params);
  expect(response.status).toBe(200);
  expect(mocks.command).toHaveBeenCalledWith(
    "prd_a",
    "bld_a",
    { ...command, reason: "Fix notes" },
    actor,
  );
  expect(mocks.rate).toHaveBeenCalledWith("contentCreation", actor.id);
});
it.each([
  { ...command, expectedRevision: undefined },
  { ...command, storageKey: "leak" },
  { ...command, action: "publish" },
])("rejects unsafe commands", async (body) => {
  expect((await PATCH(req(body), params)).status).toBe(400);
  expect(mocks.command).not.toHaveBeenCalled();
});
it.each([
  [{ "content-type": "text/plain" }, 415],
  [{ "sec-fetch-site": "cross-site" }, 403],
  [{ "content-length": "49153" }, 413],
] as const)("bounds the write request", async (headers, status) => {
  expect((await PATCH(req(command, headers), params)).status).toBe(status);
  expect(mocks.command).not.toHaveBeenCalled();
});
it("throttles writes and private version inspection", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await PATCH(req(), params)).status).toBe(429);
  expect((await GET(req(null, {}, undefined, "GET"), params)).status).toBe(429);
  expect(mocks.detail).not.toHaveBeenCalled();
});
it("forwards an explicit private conflict without leaking implementation details", async () => {
  mocks.command.mockRejectedValue(new AppError("private data", 409, "BUILD_REVISION_CONFLICT"));
  const response = await PATCH(req(), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "BUILD_REVISION_CONFLICT" });
});
it("uses separate live staff authority for admin detail", async () => {
  mocks.detail.mockResolvedValue({ build: { id: "bld_a" } });
  expect(
    (await staffGet(req(null, {}, "/api/admin/resources/prd_a/builds/bld_a", "GET"), params))
      .status,
  ).toBe(200);
  expect(mocks.detail).toHaveBeenCalledWith("prd_a", "bld_a", actor, true);
});
it.each(["approve", "reject"])("requires the displayed revision for %s", async (action) => {
  const body = { targetType: "build", targetId: "bld_a", action, notes: "Reviewed evidence" };
  const headers = { cookie: "nexus_session=staff-token" };
  const response = await moderate(req(body, headers, "/api/admin/actions", "POST"));
  expect(response.status).toBe(400);
  expect(mocks.review).not.toHaveBeenCalled();
  expect(
    (await moderate(req({ ...body, expectedRevision: 3 }, headers, "/api/admin/actions", "POST")))
      .status,
  ).toBe(200);
  expect(mocks.review).toHaveBeenCalledWith(
    { buildId: "bld_a", decision: action, notes: "Reviewed evidence", expectedRevision: 3 },
    actor,
    "staff-token",
  );
});
