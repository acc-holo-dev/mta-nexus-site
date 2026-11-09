import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../helpers/browser-mutation-headers";
const calls = vi.hoisted(() => ({ set: vi.fn(), user: { id: "actor_b" } }));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => calls.user) },
}));
vi.mock("../../apps/web/src/lib/services/follow-workspace-service", () => ({
  followWorkspaceService: { setObjectMute: calls.set },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "omi_test",
}));
import { POST } from "../../apps/web/src/app/api/object-mute/route";
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
});
it("does not change another account's mute after cookie switch", async () => {
  const request = new NextRequest("http://nexus.test/api/object-mute", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=token_b",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      targetType: "content",
      targetId: "cnt_a",
      duration: "24h",
      expectedActorId: "actor_a",
    }),
  });
  const response = await POST(request);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
  expect(calls.set).not.toHaveBeenCalled();
});
it("requires an actor precondition for mute", async () => {
  const request = new NextRequest("http://nexus.test/api/object-mute", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=token_b",
      "content-type": "application/json",
    },
    body: JSON.stringify({ targetType: "content", targetId: "cnt_a", duration: null }),
  });
  const response = await POST(request);
  expect(response.status).toBe(428);
  expect(calls.set).not.toHaveBeenCalled();
});
