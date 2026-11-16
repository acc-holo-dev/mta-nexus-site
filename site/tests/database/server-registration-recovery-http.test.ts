import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  find: vi.fn(),
  create: vi.fn(),
  allowed: true,
  rateGate: null as Promise<void> | null,
  rateEntered: null as (() => void) | null,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => {
    state.rateEntered?.();
    await state.rateGate;
    return { success: state.allowed };
  },
}));
vi.mock("../../src/lib/services/server-service", () => ({
  serverService: { recoverCreatedServer: state.find, createServer: state.create },
}));
vi.mock("../../src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {},
  indexMtaObservations: vi.fn(),
  matchesMtaEndpoint: vi.fn(),
  mtaLiveStatus: vi.fn(),
}));

import { GET } from "../../src/app/api/servers/recovery/route";
import { POST } from "../../src/app/api/servers/route";

const nonce = "a".repeat(32);
function recovery(actor = "usr_a", query = `nonce=${nonce}`) {
  return new NextRequest(`https://nexus.test/api/servers/recovery?${query}`, {
    headers: { cookie: "nexus_session=test", "x-nexus-actor-id": actor },
  });
}
function creation(actor?: string) {
  return new NextRequest("https://nexus.test/api/servers", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=test",
      "x-nexus-creation-nonce": nonce,
      ...(actor ? { "x-nexus-actor-id": actor } : {}),
    },
    body: JSON.stringify({ name: "Test", slug: "test", ipAddress: "198.51.100.10" }),
  });
}
beforeEach(() => {
  stubBrowserMutationOrigin();
  state.actor = { id: "usr_a", role: "user" };
  state.allowed = true;
  state.rateGate = null;
  state.rateEntered = null;
  state.find.mockReset();
  state.create.mockReset();
});
it("passes the original token to the recovery check after a delayed rate limit", async () => {
  let release!: () => void;
  state.rateGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    state.rateEntered = resolve;
  });
  let live = true;
  state.find.mockImplementation(async (_actor, _nonce, token) =>
    token === "test" && live ? { id: "srv_a" } : null,
  );
  const pending = GET(recovery());
  await entered;
  live = false;
  release();
  const response = await pending;
  expect(await response.json()).toEqual({ server: null });
  expect(state.find).toHaveBeenCalledWith("usr_a", nonce, "test");
});
it("fails closed on missing or changed actor before creating", async () => {
  expect((await POST(creation())).status).toBe(428);
  expect((await POST(creation("usr_b"))).status).toBe(409);
  expect(state.create).not.toHaveBeenCalled();
});
it("passes the initiating cookie and recovery nonce to creation", async () => {
  state.create.mockResolvedValueOnce({ id: "srv_a" });
  expect((await POST(creation("usr_a"))).status).toBe(201);
  expect(state.create).toHaveBeenCalledWith(
    expect.objectContaining({ slug: "test", ownerId: "usr_a" }),
    state.actor,
    nonce,
    "test",
  );
});
it("recovers only for the authenticated actor and preserves private caching", async () => {
  state.find.mockResolvedValueOnce({ id: "srv_a" });
  const result = await GET(recovery());
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(await result.json()).toEqual({ server: { id: "srv_a" } });
  expect(state.find).toHaveBeenCalledWith("usr_a", nonce, "test");
  expect((await GET(recovery("usr_b"))).status).toBe(409);
  state.actor = null;
  expect((await GET(recovery())).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.allowed = false;
  expect((await GET(recovery())).status).toBe(429);
  state.allowed = true;
  expect((await GET(recovery("usr_a", `nonce=${nonce}&nonce=${nonce}`))).status).toBe(400);
  expect(state.find).toHaveBeenCalledTimes(1);
});
