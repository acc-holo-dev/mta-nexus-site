import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  page: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/organization-content-service", () => ({
  organizationContentService: mocks,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));

import {
  DELETE,
  GET,
  PATCH,
} from "../apps/web/src/app/api/workspace/organizations/[id]/content/[contentId]/route";
import {
  GET as list,
  POST,
} from "../apps/web/src/app/api/workspace/organizations/[id]/content/route";

const actor = { id: "actor", role: "user" },
  context = { params: Promise.resolve({ id: "org", contentId: "content" }) };
const input = {
  title: "Title",
  slug: "new-publication",
  type: "article",
  body: "Publication body",
  tags: [],
  excerpt: "",
  coverImageUrl: "",
};
const request = (method = "GET", body?: unknown, query = "", headers = {}) =>
  new NextRequest(`https://nexus.test/api/workspace/organizations/org/content${query}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=session;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.page.mockResolvedValue({ items: [] });
  mocks.get.mockResolvedValue({ content: { id: "content" } });
  mocks.create.mockResolvedValue({ id: "content", organizationId: "org" });
  mocks.update.mockResolvedValue({ id: "content", organizationId: "org" });
});
it("binds collection, detail and mutation scope to the current actor and path, with private headers", async () => {
  const responses = [
    await list(request("GET", undefined, "?page=2&q=Lua&status=draft&type=news"), context),
    await GET(request(), context),
    await POST(request("POST", input), context),
    await PATCH(request("PATCH", {}), context),
    await DELETE(request("DELETE", {}), context),
  ];
  expect(mocks.page).toHaveBeenCalledWith("org", actor, {
    page: 2,
    query: "Lua",
    status: "draft",
    type: "news",
  });
  expect(mocks.get).toHaveBeenCalledWith("org", actor, "content");
  expect(mocks.create).toHaveBeenCalledWith("org", actor, input);
  expect(mocks.update).toHaveBeenCalledWith("org", actor, "content", {}, false);
  expect(mocks.update).toHaveBeenCalledWith("org", actor, "content", {}, true);
  for (const response of responses) {
    expect(response.status).toBe(response === responses[2] ? 201 : 200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  }
});
it.each([
  "?actorId=victim",
  "?organizationId=foreign",
  "?page=10000",
  "?q=x&q=y",
  "?status=private",
  "?type=product",
  `?q=${"x".repeat(121)}`,
])("rejects scope injection and malformed collection filters %s", async (query) => {
  expect((await list(request("GET", undefined, query), context)).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("rejects anonymous, cross-site, non-JSON and oversized operations before writes", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request("POST", input), context)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  for (const action of [POST, PATCH, DELETE]) {
    expect(
      (await action(request("POST", {}, "", { "sec-fetch-site": "cross-site" }), context)).status,
    ).toBe(403);
    expect(
      (await action(request("POST", {}, "", { "content-type": "text/plain" }), context)).status,
    ).toBe(415);
    expect((await action(request("POST", { body: "x".repeat(140000) }), context)).status).toBe(413);
    expect((await action(request("POST", {}, "?actorId=victim"), context)).status).toBe(400);
  }
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("rejects invalid path identity and localizes permission/conflict/uncertain outcomes", async () => {
  expect(
    (await GET(request(), { params: Promise.resolve({ id: "org/foreign", contentId: "content" }) }))
      .status,
  ).toBe(404);
  for (const [code, status] of [
    ["FORBIDDEN", 403],
    ["CONFLICT", 409],
    ["CONTENT_ARCHIVED", 409],
  ] as const) {
    mocks.update.mockRejectedValue(new AppError("private SQL", status, code));
    const response = await PATCH(request("PATCH", {}), context);
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain("private SQL");
  }
  mocks.update.mockRejectedValue(new Error("private SQL"));
  expect((await PATCH(request("PATCH", {}), context)).status).toBe(503);
});
it("rate-limits all reads and writes", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  for (const action of [list, GET, POST, PATCH, DELETE])
    expect((await action(request("POST", {}), context)).status).toBe(429);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
