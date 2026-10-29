import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  page: vi.fn(),
  disable: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate, generateId: () => "aud_a" }));
vi.mock("@nexus/db", () => ({
  resourceReleaseWatchesRepository: {
    page: h.page,
    disableBatch: h.disable,
    resumeBatch: h.resume,
  },
}));
import { GET as exportPage } from "../apps/web/src/app/api/library/watches/export/route";
import { POST as resume } from "../apps/web/src/app/api/library/watches/resume/route";
const command = { items: [{ productId: "prd_a", expectedRevision: 1 }] };
const get = (query = "") =>
  new NextRequest(`https://nexus.test/api/library/watches/export${query}`);
const post = (body: unknown = command, query = "", headers: Record<string, string> = {}) =>
  new NextRequest(`https://nexus.test/api/library/watches/resume${query}`, {
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
  expect((await resume(post())).status).toBe(401);
  expect(h.page).not.toHaveBeenCalled();
  expect(h.disable).not.toHaveBeenCalled();
});

it("binds reviewed resume commands to the session and private mutation transport", async () => {
  h.resume.mockResolvedValue({ items: [], changedCount: 1 });
  const response = await resume(post());
  expect(response.status).toBe(200);
  expect(h.resume).toHaveBeenCalledWith({
    userId: "usr_a",
    currentToken: "tok_a",
    auditId: "aud_a",
    command,
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
it.each([
  { ...command, userId: "other" },
  { ...command, enabled: true },
  { items: [{ productId: "prd_a", expectedRevision: 0 }] },
  { items: [...command.items, ...command.items] },
])("rejects forged scopes or invalid existing watch commands", async (body) => {
  expect((await resume(post(body))).status).toBe(400);
  expect(h.resume).not.toHaveBeenCalled();
});
it("rejects query scopes, oversized bodies, unsafe origins and rate excess", async () => {
  expect((await resume(post(command, "?userId=other"))).status).toBe(400);
  expect((await resume(post({ ...command, extra: "x".repeat(8193) }))).status).toBe(413);
  expect(
    (
      await resume(
        post(command, "", { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
      )
    ).status,
  ).toBe(403);
  h.rate.mockResolvedValue({ success: false });
  expect((await resume(post())).status).toBe(429);
  expect(h.resume).not.toHaveBeenCalled();
});

it("rejects a missing raw cookie before consuming a mutation body", async () => {
  const incoming = new NextRequest("https://nexus.test/api/library/watches/prd_a", {
    method: "POST",
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
    body: "{",
  });
  const read = vi.spyOn(incoming, "text");
  expect((await resume(incoming)).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
  expect(h.resume).not.toHaveBeenCalled();
});
