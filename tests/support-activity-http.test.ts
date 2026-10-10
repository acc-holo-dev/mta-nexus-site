import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), rate: vi.fn(), history: vi.fn() }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("@nexus/db", () => ({ supportActivityRepository: { history: mocks.history } }));
import { GET } from "../apps/web/src/app/api/support/[id]/activity/route";
const id = `sup_${"a".repeat(24)}`,
  context = { params: Promise.resolve({ id }) };
function request(query = "") {
  return new NextRequest(`https://nexus.test/api/support/${id}/activity${query}`, {
    headers: { cookie: "nexus_session=test;nexus_locale=ru" },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  mocks.rate.mockResolvedValue({ success: true });
  mocks.history.mockResolvedValue({
    items: [
      {
        id: "audit",
        from: "open",
        to: "resolved",
        by: "staff",
        createdAt: new Date("2026-10-11T00:00:00Z"),
      },
    ],
    nextCursor: null,
  });
});
it("binds private status history to the session and validates the narrow result", async () => {
  const response = await GET(request("?before=audit_before"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.history).toHaveBeenCalledWith(id, "actor", "audit_before");
  expect((await response.json()).items[0]).toEqual({
    id: "audit",
    from: "open",
    to: "resolved",
    by: "staff",
    createdAt: "2026-10-11T00:00:00.000Z",
  });
});
it.each(["?before=", "?before=x&before=y", "?actorId=victim", "?before=../other"])(
  "rejects unsafe cursor %s before repository work",
  async (query) => {
    expect((await GET(request(query), context)).status).toBe(400);
    expect(mocks.history).not.toHaveBeenCalled();
  },
);
it("rejects anonymous access, malformed case IDs and exhausted rates", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await GET(request(), context)).status).toBe(401);
  mocks.session.mockResolvedValue({ id: "actor" });
  expect((await GET(request(), { params: Promise.resolve({ id: "../other" }) })).status).toBe(404);
  mocks.rate.mockResolvedValue({ success: false });
  expect((await GET(request(), context)).status).toBe(429);
  expect(mocks.history).not.toHaveBeenCalled();
});
it("keeps foreign/expired cases and storage failures private and localized", async () => {
  mocks.history.mockRejectedValueOnce(new AppError("secret internal target", 404, "NOT_FOUND"));
  const missing = await GET(request(), context);
  expect(missing.status).toBe(404);
  expect(await missing.text()).not.toContain("secret internal");
  mocks.history.mockRejectedValueOnce(new Error("database connection secret"));
  const failed = await GET(request(), context);
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("database connection");
});
