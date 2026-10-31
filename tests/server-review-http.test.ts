import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  ip: "unknown",
  command: vi.fn(),
  ownDetail: vi.fn(),
  publicPage: vi.fn(),
  moderate: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => state.ip }));
vi.mock("@nexus/security", () => ({
  generateId: (prefix: string) => `${prefix}_generated`,
  consumeRateLimit: async (...args: unknown[]) => {
    state.rate(...args);
    return { success: state.allowed };
  },
}));
vi.mock("@nexus/db", () => ({
  serverReviewsRepository: {
    command: state.command,
    ownDetail: state.ownDetail,
    publicPage: state.publicPage,
    moderate: state.moderate,
  },
}));

import { POST as moderate } from "../apps/web/src/app/api/admin/servers/reviews/[id]/route";
import { GET as mine } from "../apps/web/src/app/api/servers/[id]/reviews/mine/route";
import {
  POST as mutate,
  GET as publicPage,
} from "../apps/web/src/app/api/servers/[id]/reviews/route";

const context = { params: Promise.resolve({ id: "srv_a" }) };
const adminContext = { params: Promise.resolve({ id: "cmt_a" }) };
const request = (url: string, body?: unknown) =>
  new NextRequest(`https://nexus.test${url}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { ...browserMutationHeaders(), "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.allowed = true;
  state.ip = "unknown";
  for (const fn of [state.command, state.ownDetail, state.publicPage, state.moderate]) {
    fn.mockReset().mockResolvedValue({ id: "cmt_generated", revision: 1, status: "published" });
  }
});

it("requires authentication for private own-review reads", async () => {
  state.actor = null;
  const response = await mine(request("/api/servers/srv_a/reviews/mine"), context);
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

it("scopes own detail to the session actor before repository reads", async () => {
  const response = await mine(request("/api/servers/srv_a/reviews/mine"), context);
  expect(response.status).toBe(200);
  expect(state.ownDetail).toHaveBeenCalledWith("usr_a", "srv_a");
});

it("publishes verified-interaction reviews through the reviewSubmission rate policy", async () => {
  const response = await mutate(
    request("/api/servers/srv_a/reviews", { text: "Good community", rating: 5 }),
    context,
  );
  expect(response.status).toBe(201);
  expect(state.rate).toHaveBeenCalledWith("reviewSubmission", "usr_a");
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      serverId: "srv_a",
      command: { action: "save", expectedRevision: 0, text: "Good community", rating: 5 },
    }),
  );
});

it("maps missing verified interaction to a fail-closed 403", async () => {
  state.command.mockRejectedValueOnce(
    new AppError("Verified server interaction is required", 403, "REVIEW_ACCESS_REQUIRED"),
  );
  const response = await mutate(
    request("/api/servers/srv_a/reviews", { text: "Drive-by", rating: 1 }),
    context,
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
});

it("keeps staff removal behind moderator/admin authority", async () => {
  state.actor = { id: "usr_mod", role: "moderator" };
  const response = await moderate(
    request("/api/admin/servers/reviews/cmt_a", {
      action: "remove",
      expectedRevision: 2,
      notes: "Abuse campaign",
    }),
    adminContext,
  );
  expect(response.status).toBe(200);
  expect(state.rate).toHaveBeenCalledWith("moderationAction", "usr_mod");
  expect(state.moderate).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_mod",
      reviewId: "cmt_a",
      command: { action: "remove", expectedRevision: 2, notes: "Abuse campaign" },
    }),
  );
});

it("rejects non-staff moderation attempts before repository writes", async () => {
  state.moderate.mockRejectedValueOnce(new AppError("Forbidden", 403, "FORBIDDEN"));
  const response = await moderate(
    request("/api/admin/servers/reviews/cmt_a", {
      action: "remove",
      expectedRevision: 1,
      notes: "Nope",
    }),
    adminContext,
  );
  expect(response.status).toBe(403);
});

it("serves public review pages without session and rejects bad paging", async () => {
  state.actor = null;
  state.publicPage.mockResolvedValueOnce({ reviews: [], total: 0, page: 1, totalPages: 1 });
  const ok = await publicPage(request("/api/servers/srv_a/reviews"), context);
  expect(ok.status).toBe(200);
  expect(state.publicPage).toHaveBeenCalledWith("srv_a", 1);

  const bad = await publicPage(request("/api/servers/srv_a/reviews?page=0"), context);
  expect(bad.status).toBe(400);
});
