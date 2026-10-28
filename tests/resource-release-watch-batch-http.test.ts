import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  page: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate, generateId: () => "aud_a" }));
vi.mock("@nexus/db", () => ({
  resourceReleaseWatchesRepository: { page: h.page, disableBatch: h.disable },
}));
import { GET as exportPage } from "../apps/web/src/app/api/library/watches/export/route";
import { POST as disable } from "../apps/web/src/app/api/library/watches/disable/route";
const command = { items: [{ productId: "prd_a", expectedRevision: 1 }] };
const get = (query = "") =>
  new NextRequest(`https://nexus.test/api/library/watches/export${query}`);
const post = (body: unknown = command, query = "", headers: Record<string, string> = {}) =>
  new NextRequest(`https://nexus.test/api/library/watches/disable${query}`, {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  h.user = { id: "usr_a" };
  h.rate.mockResolvedValue({ success: true });
  h.disable.mockResolvedValue({ items: [], changedCount: 1 });
  h.page.mockResolvedValue({
    items: [
      {
        productId: "prd_a",
        enabled: true,
        revision: 1,
        updatedAt: new Date("2026-10-12T00:00:00.000Z"),
        available: false,
        title: "SECRET-TITLE",
        lastSequence: 123n,
        userId: "SECRET-USER",
      },
    ],
    counts: { all: 1, enabled: 1, disabled: 0, unavailable: 1 },
    page: 1,
    totalPages: 1,
    pageSize: 20,
    total: 1,
    lastSequence: 123n,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("authenticates both operations before reaching repositories", async () => {
  h.user = null;
  expect((await exportPage(get())).status).toBe(401);
  expect((await disable(post())).status).toBe(401);
  expect(h.page).not.toHaveBeenCalled();
  expect(h.disable).not.toHaveBeenCalled();
});
it("exports one private searched page with only masked public watch fields", async () => {
  const response = await exportPage(get("?query=Core&filter=enabled&page=2"));
  expect(response.status).toBe(200);
  expect(h.page).toHaveBeenCalledWith("usr_a", 2, "enabled", "Core");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-disposition")).toContain("attachment");
  const body = await response.json();
  expect(body.items[0].title).toBeNull();
  expect(JSON.stringify(body)).not.toMatch(/SECRET|lastSequence|userId/u);
});
it("binds bulk stop to the session and records only a strict disable command", async () => {
  const response = await disable(post());
  expect(response.status).toBe(200);
  expect(h.disable).toHaveBeenCalledWith({ userId: "usr_a", auditId: "aud_a", command });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each([
  { ...command, userId: "foreign" },
  { ...command, enabled: true },
  { items: [] },
  { items: [...command.items, ...command.items] },
])("rejects injected authority or invalid batch %j", async (body) => {
  expect((await disable(post(body))).status).toBe(400);
  expect(h.disable).not.toHaveBeenCalled();
});
it("rejects query selectors, cross-site/text mutations and excess body size", async () => {
  expect((await disable(post(command, "?userId=other"))).status).toBe(400);
  expect(
    (
      await disable(
        post(command, "", { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
      )
    ).status,
  ).toBe(403);
  expect((await disable(post(command, "", { "content-type": "text/plain" }))).status).toBe(415);
  expect((await disable(post({ ...command, extra: "x".repeat(8193) }))).status).toBe(413);
  expect(h.disable).not.toHaveBeenCalled();
});
it("bounds exports and rate limits both operations", async () => {
  const value = await h.page();
  value.items[0].available = true;
  value.items[0].title = "x".repeat(524289);
  h.page.mockResolvedValue(value);
  expect((await exportPage(get())).status).toBe(413);
  h.rate.mockResolvedValue({ success: false });
  h.page.mockClear();
  expect((await exportPage(get())).status).toBe(429);
  expect((await disable(post())).status).toBe(429);
  expect(h.page).not.toHaveBeenCalled();
  expect(h.disable).not.toHaveBeenCalled();
});
