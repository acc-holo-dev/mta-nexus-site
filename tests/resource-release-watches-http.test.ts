import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  command: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate, generateId: () => "aud_a" }));
vi.mock("@nexus/db", () => ({
  resourceReleaseWatchesRepository: {
    page: state.page,
    detail: state.detail,
    command: state.command,
  },
}));
import { GET as page } from "../apps/web/src/app/api/library/watches/route";
import { GET as detail, POST as command } from "../apps/web/src/app/api/library/watches/[id]/route";
const context = { params: Promise.resolve({ id: "prd_a" }) };
const request = (
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
) =>
  new NextRequest("https://nexus.test/api/library/watches/prd_a", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.page.mockResolvedValue({ items: [] });
  state.detail.mockResolvedValue({ enabled: false });
  state.command.mockResolvedValue({ productId: "prd_a", enabled: true, revision: 1 });
});
it("serves private session-scoped reads with inspection rate limiting", async () => {
  const response = await page(
    new NextRequest("https://nexus.test/api/library/watches?filter=enabled&page=2"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.page).toHaveBeenCalledWith("usr_a", 2, "enabled", "");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(
    (await detail(new NextRequest("https://nexus.test/api/library/watches/prd_a"), context)).status,
  ).toBe(200);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "prd_a");
});
it("authenticates before parsing, refuses forged scopes and bounds mutation bodies", async () => {
  state.user = null;
  expect((await command(request({ enabled: true, expectedRevision: 0 }), context)).status).toBe(
    401,
  );
  expect(state.command).not.toHaveBeenCalled();
  state.user = { id: "usr_a" };
  expect(
    (await command(request({ enabled: true, expectedRevision: 0, userId: "other" }), context))
      .status,
  ).toBe(400);
  expect(
    (
      await command(
        request({ enabled: true, expectedRevision: 0, data: "x".repeat(2100) }),
        context,
      )
    ).status,
  ).toBe(413);
  expect((await command(request({ enabled: true, expectedRevision: 0 }, {}), context)).status).toBe(
    415,
  );
  expect(
    (
      await command(
        request(
          { enabled: true, expectedRevision: 0 },
          { "content-type": "application/json", "sec-fetch-site": "cross-site" },
        ),
        context,
      )
    ).status,
  ).toBe(403);
  expect(state.command).not.toHaveBeenCalled();
});
it("revision-scoped commands use the existing mutation guard and never accept progress writes", async () => {
  expect((await command(request({ enabled: true, expectedRevision: 0 }), context)).status).toBe(
    200,
  );
  expect(state.command).toHaveBeenCalledWith({
    userId: "usr_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  });
  state.command.mockRejectedValue(new AppError("private state", 409, "RELEASE_WATCH_CONFLICT"));
  const response = await command(request({ enabled: true, expectedRevision: 0 }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "RELEASE_WATCH_CONFLICT" });
});
it("refuses rate excess and account selectors on the read archive", async () => {
  expect(
    (await page(new NextRequest("https://nexus.test/api/library/watches?userId=other"))).status,
  ).toBe(400);
  state.rate.mockResolvedValue({ success: false });
  expect((await page(new NextRequest("https://nexus.test/api/library/watches"))).status).toBe(429);
  expect(state.page).not.toHaveBeenCalled();
});

it("rejects query selectors on a single watch read or mutation", async () => {
  const url = "https://nexus.test/api/library/watches/prd_a?userId=other";
  expect((await detail(new NextRequest(url), context)).status).toBe(400);
  expect(
    (
      await command(
        new NextRequest(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: true, expectedRevision: 0 }),
        }),
        context,
      )
    ).status,
  ).toBe(400);
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.command).not.toHaveBeenCalled();
});
