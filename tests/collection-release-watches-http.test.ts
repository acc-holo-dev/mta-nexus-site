import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  page: vi.fn(),
  enable: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate, generateId: () => "aud_a" }));
vi.mock("@nexus/db", () => ({
  resourceReleaseWatchesRepository: { collectionPage: h.page, enableCollectionBatch: h.enable },
}));
import { GET, POST } from "../apps/web/src/app/api/library/collections/[id]/watches/route";
const context = { params: Promise.resolve({ id: "lcol_a" }) };
const command = {
  expectedCollectionRevision: 3,
  items: [{ productId: "prd_a", expectedRevision: 0 }],
};
const get = (query = "") =>
  new NextRequest(`https://nexus.test/api/library/collections/lcol_a/watches${query}`);
const post = (body: unknown = command, query = "", headers: Record<string, string> = {}) =>
  new NextRequest(`https://nexus.test/api/library/collections/lcol_a/watches${query}`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=tok_a",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  h.user = { id: "usr_a" };
  h.rate.mockResolvedValue({ success: true });
  h.page.mockResolvedValue({ items: [] });
  h.enable.mockResolvedValue({ items: [], changedCount: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("authenticates collection reads and writes before calling repositories", async () => {
  h.user = null;
  expect((await GET(get(), context)).status).toBe(401);
  expect((await POST(post(), context)).status).toBe(401);
  expect(h.page).not.toHaveBeenCalled();
  expect(h.enable).not.toHaveBeenCalled();
});
it("binds collection search and enrollment to the signed-in owner and route collection", async () => {
  const read = await GET(get("?filter=disabled&page=2&query=Core"), context);
  expect(read.status).toBe(200);
  expect(h.page).toHaveBeenCalledWith("usr_a", "lcol_a", 2, "disabled", "Core");
  const saved = await POST(post(), context);
  expect(saved.status).toBe(200);
  expect(h.enable).toHaveBeenCalledWith({
    userId: "usr_a",
    currentToken: "tok_a",
    collectionId: "lcol_a",
    command,
    auditId: "aud_a",
  });
  for (const response of [read, saved]) {
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  }
});
it.each([
  { ...command, userId: "other" },
  { ...command, collectionId: "lcol_other" },
  { ...command, lastSequence: 999 },
  { ...command, enabled: false },
  { ...command, expectedCollectionRevision: 0 },
])("rejects forged enrollment fields %j", async (body) => {
  expect((await POST(post(body), context)).status).toBe(400);
  expect(h.enable).not.toHaveBeenCalled();
});
it("requires bounded same-site JSON transport and no query selectors", async () => {
  expect((await POST(post(command, "?userId=other"), context)).status).toBe(400);
  expect(
    (
      await POST(
        post(command, "", { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect((await POST(post(command, "", { "content-type": "text/plain" }), context)).status).toBe(
    415,
  );
  expect((await POST(post({ ...command, extra: "x".repeat(8193) }), context)).status).toBe(413);
  expect(h.enable).not.toHaveBeenCalled();
});
it("sanitizes stale membership errors and rate limits both operations", async () => {
  h.enable.mockRejectedValueOnce(
    new AppError("private internal state", 409, "RELEASE_WATCH_COLLECTION_CONFLICT"),
  );
  const response = await POST(post(), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" });
  h.rate.mockResolvedValue({ success: false });
  h.page.mockClear();
  h.enable.mockClear();
  expect((await GET(get(), context)).status).toBe(429);
  expect((await POST(post(), context)).status).toBe(429);
  expect(h.page).not.toHaveBeenCalled();
  expect(h.enable).not.toHaveBeenCalled();
});

it("rejects a missing raw cookie before consuming a mutation body", async () => {
  const incoming = new NextRequest("https://nexus.test/api/library/watches/prd_a", {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
    body: "{",
  });
  const read = vi.spyOn(incoming, "text");
  expect((await POST(incoming, context)).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
  expect(h.enable).not.toHaveBeenCalled();
});
