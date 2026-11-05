import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  allowed: true,
  find: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
vi.mock("../apps/web/src/lib/services/community-topic-recovery-service", () => ({
  communityTopicRecoveryService: { findOwned: state.find },
}));

import { GET } from "../apps/web/src/app/api/content/recovery/route";

function request(query = "slug=my-topic-123", actor = "usr_a") {
  return new NextRequest(`https://nexus.test/api/content/recovery?${query}`, {
    headers: { cookie: "nexus_session=session", "x-nexus-actor-id": actor },
  });
}
beforeEach(() => {
  state.actor = { id: "usr_a" };
  state.allowed = true;
  state.find.mockReset();
});
it("limits recovery to the authenticated actor and returns a private result", async () => {
  state.find.mockResolvedValueOnce(null);
  const result = await GET(request());
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ content: null });
  expect(state.find).toHaveBeenCalledWith("my-topic-123", "usr_a");
  expect((await GET(request("slug=my-topic-123", "usr_b"))).status).toBe(409);
  expect(state.find).toHaveBeenCalledTimes(1);
});
it("denies guests, rate-limited callers and malformed lookups before reading", async () => {
  state.actor = null;
  expect((await GET(request())).status).toBe(401);
  state.actor = { id: "usr_a" };
  state.allowed = false;
  expect((await GET(request())).status).toBe(429);
  state.allowed = true;
  expect((await GET(request("slug=x&slug=y"))).status).toBe(400);
  expect((await GET(request("slug=my-topic&extra=x"))).status).toBe(400);
  expect(state.find).not.toHaveBeenCalled();
});
