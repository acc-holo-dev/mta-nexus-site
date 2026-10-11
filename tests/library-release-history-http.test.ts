import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate }));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { history: h.history },
}));
import { GET } from "../apps/web/src/app/api/library/releases/history/route";
import { GET as download } from "../apps/web/src/app/api/library/releases/history/export/route";
const request = (query = "") =>
  new NextRequest(`https://nexus.test/api/library/releases/history${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { id: "usr_a", role: "user" };
  h.rate.mockResolvedValue({ success: true });
  h.history.mockResolvedValue({ items: [], days: 30 });
});
it("authenticates and scopes private history and attachment responses", async () => {
  const result = await GET(request("?days=90&page=2&productId=prd_a"));
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toContain("no-store");
  expect(result.headers.get("vary")).toContain("Cookie");
  expect(h.history).toHaveBeenCalledWith(h.actor, { days: 90, page: 2, productId: "prd_a" });
  const response = await download(
    new NextRequest("https://nexus.test/api/library/releases/history/export"),
  );
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it("rejects scope injection, duplicates and missing authentication before history reads", async () => {
  for (const query of ["?userId=other", "?days=7&days=30", "?productId=../other", "?page=1001"])
    expect((await GET(request(query))).status).toBe(400);
  expect(h.history).not.toHaveBeenCalled();
  h.actor = null;
  expect((await GET(request())).status).toBe(401);
  expect((await download(request())).status).toBe(401);
});
it("rate limits inspection and bounds JSON export size", async () => {
  h.rate.mockResolvedValueOnce({ success: false });
  expect((await GET(request())).status).toBe(429);
  expect(h.history).not.toHaveBeenCalled();
  h.history.mockResolvedValue({ text: "x".repeat(512 * 1024) });
  expect((await download(request())).status).toBe(413);
});
it("does not expose private errors for an absent current account", async () => {
  h.history.mockRejectedValue(new AppError("Private account details", 404, "NOT_FOUND"));
  const result = await GET(request());
  expect(result.status).toBe(404);
  expect(await result.text()).not.toContain("Private account details");
});
