import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  history: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate }));
vi.mock("@nexus/db", () => ({ resourceReleaseWatchesRepository: { history: h.history } }));
import { GET as read } from "../apps/web/src/app/api/library/watches/history/route";
import { GET as download } from "../apps/web/src/app/api/library/watches/history/export/route";
const request = (query = "") =>
  new NextRequest(`https://nexus.test/api/library/watches/history${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "usr_a" };
  h.rate.mockResolvedValue({ success: true });
  h.history.mockResolvedValue({ schemaVersion: 1, items: [], page: 1 });
});
it("authenticates reads and exports before loading recorded changes", async () => {
  h.user = null;
  for (const route of [read, download]) expect((await route(request())).status).toBe(401);
  expect(h.history).not.toHaveBeenCalled();
});
it("keeps own filtered history private and uses inspection limits", async () => {
  const response = await read(request("?source=batch&days=7&productId=prd_a&page=2"));
  expect(response.status).toBe(200);
  expect(h.history).toHaveBeenCalledWith("usr_a", {
    source: "batch",
    days: 7,
    productId: "prd_a",
    page: 2,
  });
  expect(h.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
it.each([
  "?actorId=other",
  "?source=system",
  "?source=batch&source=all",
  "?days=366",
  "?page=1001",
])("rejects history selector injection %s", async (query) => {
  expect((await read(request(query))).status).toBe(400);
  expect(h.history).not.toHaveBeenCalled();
});
it("exports a bounded private attachment and refuses rate excess", async () => {
  const response = await download(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  h.history.mockResolvedValue({ items: [{ title: "x".repeat(524289) }] });
  expect((await download(request())).status).toBe(413);
  h.rate.mockResolvedValue({ success: false });
  h.history.mockClear();
  expect((await read(request())).status).toBe(429);
  expect(h.history).not.toHaveBeenCalled();
});
