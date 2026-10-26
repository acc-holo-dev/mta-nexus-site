import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  applications: vi.fn(),
  application: vi.fn(),
  amend: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: state,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import {
  PATCH as amend,
  GET as detail,
} from "../apps/web/src/app/api/workspace/verification/[id]/route";
import { GET as history } from "../apps/web/src/app/api/workspace/verification/history/route";

const context = { params: Promise.resolve({ id: "request" }) },
  revision = "a".repeat(64),
  input = {
    expectedRevision: revision,
    proofUrl: "https://example.test/proof",
    notes: "Updated evidence",
  };
const request = (
  method = "GET",
  query = "",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://nexus.test/api/workspace/verification/history${query}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : browserMutationHeaders()),
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.session.mockResolvedValue({ id: "actor" });
  state.rate.mockResolvedValue({ success: true });
  state.applications.mockResolvedValue({ items: [], olderCursor: null, newerCursor: null });
  state.application.mockResolvedValue({});
  state.amend.mockResolvedValue({ id: "request", status: "pending", revision: "b".repeat(64) });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("returns authenticated private history with normalized search filters", async () => {
  const response = await history(request("GET", "?q=word&type=developer&status=pending"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.applications).toHaveBeenCalledWith(
    { id: "actor" },
    expect.objectContaining({ query: "word", type: "developer", status: "pending" }),
  );
});
it.each(["history", "detail", "amend"])(
  "requires session and rate budget for %s",
  async (target) => {
    const call = () =>
      target === "history"
        ? history(request())
        : target === "detail"
          ? detail(request(), context)
          : amend(request("PATCH", "", input), context);
    state.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    state.session.mockResolvedValue({ id: "actor" });
    state.rate.mockResolvedValue({ success: false });
    expect((await call()).status).toBe(429);
    expect(state.applications).not.toHaveBeenCalled();
    expect(state.application).not.toHaveBeenCalled();
    expect(state.amend).not.toHaveBeenCalled();
  },
);
it.each([
  "?actorId=foreign",
  "?q=one&q=two",
  "?type=product",
  "?status=draft",
  "?cursor=bad",
  "?page=9999",
])("rejects filter injection %s", async (query) => {
  expect((await history(request("GET", query))).status).toBe(400);
  expect(state.applications).not.toHaveBeenCalled();
});
it("passes exact own command and rejects cross-site, query injection, wrong media and excessive bytes", async () => {
  expect((await amend(request("PATCH", "", input), context)).status).toBe(200);
  expect(state.amend).toHaveBeenCalledWith({ id: "actor" }, "request", input);
  state.amend.mockClear();
  expect(
    (await amend(request("PATCH", "", input, { "sec-fetch-site": "cross-site" }), context)).status,
  ).toBe(403);
  expect((await amend(request("PATCH", "?status=approved", input), context)).status).toBe(400);
  expect(
    (await amend(request("PATCH", "", input, { "content-type": "text/plain" }), context)).status,
  ).toBe(415);
  expect((await amend(request("PATCH", "", { data: "x".repeat(16384) }), context)).status).toBe(
    413,
  );
  expect(state.amend).not.toHaveBeenCalled();
});
it("rejects detail query parameters before storage", async () => {
  expect((await detail(request("GET", "?actorId=foreign"), context)).status).toBe(400);
  expect(state.application).not.toHaveBeenCalled();
});
it.each([
  [409, "VERIFICATION_APPLICATION_CHANGED"],
  [422, "VERIFICATION_APPLICATION_READ_ONLY"],
  [403, "VERIFICATION_AUTHORITY_CHANGED"],
  [404, "NOT_FOUND"],
])("localizes evidence failure %s/%s without internal details", async (status, code) => {
  state.amend.mockRejectedValue(
    new AppError("PRIVATE_DATABASE_DETAILS", status as number, code as string),
  );
  const response = await amend(request("PATCH", "", input), context);
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain("PRIVATE_DATABASE_DETAILS");
});
it("distinguishes service failure from an empty history", async () => {
  state.applications.mockRejectedValue(Error("PRIVATE_DATABASE_DETAILS"));
  const response = await history(request());
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).not.toContain("PRIVATE_DATABASE_DETAILS");
  expect(body).not.toContain("items");
});
