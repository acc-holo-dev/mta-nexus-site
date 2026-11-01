import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  ip: "unknown",
  publicPage: vi.fn(),
  threadDetail: vi.fn(),
  ask: vi.fn(),
  answer: vi.fn(),
  resolve: vi.fn(),
  follow: vi.fn(),
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
  resourceQaRepository: {
    publicPage: state.publicPage,
    threadDetail: state.threadDetail,
    ask: state.ask,
    answer: state.answer,
    resolve: state.resolve,
    follow: state.follow,
  },
}));

import { GET as list, POST as ask } from "../apps/web/src/app/api/products/[id]/qa/route";
import { GET as detail } from "../apps/web/src/app/api/products/[id]/qa/[threadId]/route";
import { POST as answer } from "../apps/web/src/app/api/products/[id]/qa/[threadId]/answers/route";
import { POST as resolve } from "../apps/web/src/app/api/products/[id]/qa/[threadId]/resolve/route";
import { POST as follow } from "../apps/web/src/app/api/products/[id]/qa/[threadId]/follow/route";

const productContext = { params: Promise.resolve({ id: "prd_a" }) };
const threadContext = { params: Promise.resolve({ id: "prd_a", threadId: "rqt_a" }) };

const request = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`https://nexus.test${url}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { ...browserMutationHeaders(), "Content-Type": "application/json", ...headers },
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
  for (const fn of [
    state.publicPage,
    state.threadDetail,
    state.ask,
    state.answer,
    state.resolve,
    state.follow,
  ])
    fn.mockReset().mockResolvedValue({});
});

it("lists public Q&A without requiring a session", async () => {
  state.actor = null;
  state.publicPage.mockResolvedValue({
    threads: [{ id: "rqt_a", body: "How do I install this?" }],
    capabilities: { canAsk: false, askReason: "sign_in" },
    page: 1,
  });
  const response = await list(request("/api/products/prd_a/qa"), productContext);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(state.publicPage).toHaveBeenCalledWith("prd_a", 1, null);
});

it("limits shared public Q&A reads by trusted client address", async () => {
  state.ip = "203.0.113.9";
  state.allowed = false;
  expect((await list(request("/api/products/prd_a/qa"), productContext)).status).toBe(429);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "qa-ip:203.0.113.9");
  expect(state.publicPage).not.toHaveBeenCalled();
});

it.each([null, { body: "" }, { body: "ok", buildId: 1 }, { body: "Valid", rating: 5 }])(
  "rejects invalid ask %s without writing",
  async (body) => {
    expect((await ask(request("/api/products/prd_a/qa", body), productContext)).status).toBe(400);
    expect(state.ask).not.toHaveBeenCalled();
  },
);

it("asks only as the authenticated actor and never touches review ratings", async () => {
  state.ask.mockResolvedValue({ id: "rqt_generated", revision: 1, status: "open" });
  const response = await ask(
    request("/api/products/prd_a/qa", { body: "How do I configure this resource?" }),
    productContext,
  );
  expect(response.status).toBe(201);
  expect(state.ask).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      productId: "prd_a",
      command: expect.objectContaining({
        action: "ask",
        body: "How do I configure this resource?",
      }),
    }),
  );
  const payload = await response.json();
  expect(payload).not.toHaveProperty("rating");
  expect(payload).not.toHaveProperty("ratingAverage");
});

it("requires authentication for ask/answer/resolve/follow", async () => {
  state.actor = null;
  for (const route of [
    () => ask(request("/api/products/prd_a/qa", { body: "Need help installing" }), productContext),
    () =>
      answer(
        request("/api/products/prd_a/qa/rqt_a/answers", {
          body: "Use the published build notes.",
          expectedThreadRevision: 1,
        }),
        threadContext,
      ),
    () =>
      resolve(
        request("/api/products/prd_a/qa/rqt_a/resolve", {
          action: "resolve",
          answerId: "rqa_a",
          expectedRevision: 1,
        }),
        threadContext,
      ),
    () =>
      follow(
        request("/api/products/prd_a/qa/rqt_a/follow", { action: "follow", expectedRevision: 0 }),
        threadContext,
      ),
  ]) {
    const response = await route();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  }
});

it("loads a thread detail and answers without inventing download access", async () => {
  state.threadDetail.mockResolvedValue({
    thread: {
      id: "rqt_a",
      body: "Does v2 work?",
      buildContext: { version: "2.0.0", available: false },
      answers: [],
      following: false,
      followRevision: 0,
    },
    capabilities: { canAsk: true, canAnswer: false, canResolve: false, askReason: "ok" },
  });
  const response = await detail(request("/api/products/prd_a/qa/rqt_a"), threadContext);
  expect(response.status).toBe(200);
  expect(state.threadDetail).toHaveBeenCalledWith("prd_a", "rqt_a", "usr_a");
  const payload = await response.json();
  expect(payload.thread.buildContext.available).toBe(false);
  expect(payload.thread).not.toHaveProperty("storageKey");
});

it("answers and resolves through the authenticated service path", async () => {
  state.answer.mockResolvedValue({
    threadId: "rqt_a",
    answerId: "rqa_generated",
    threadRevision: 2,
  });
  state.resolve.mockResolvedValue({
    threadId: "rqt_a",
    status: "resolved",
    revision: 3,
    resolvedAnswerId: "rqa_generated",
  });
  expect(
    (
      await answer(
        request("/api/products/prd_a/qa/rqt_a/answers", {
          body: "Yes, use the current published build.",
          expectedThreadRevision: 1,
        }),
        threadContext,
      )
    ).status,
  ).toBe(201);
  expect(state.answer).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      threadId: "rqt_a",
      command: expect.objectContaining({ action: "answer" }),
    }),
  );
  expect(
    (
      await resolve(
        request("/api/products/prd_a/qa/rqt_a/resolve", {
          action: "resolve",
          answerId: "rqa_generated",
          expectedRevision: 2,
        }),
        threadContext,
      )
    ).status,
  ).toBe(200);
});

it("follows a thread without enabling release watches", async () => {
  state.follow.mockResolvedValue({
    threadId: "rqt_a",
    following: true,
    revision: 1,
    replayed: false,
  });
  const response = await follow(
    request("/api/products/prd_a/qa/rqt_a/follow", { action: "follow", expectedRevision: 0 }),
    threadContext,
  );
  expect(response.status).toBe(200);
  expect(state.follow).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      command: { action: "follow", expectedRevision: 0 },
    }),
  );
  const payload = await response.json();
  expect(payload.following).toBe(true);
  expect(payload).not.toHaveProperty("releaseWatch");
});

it("maps repository AppError codes for Q&A reads", async () => {
  state.publicPage.mockRejectedValue(new AppError("missing", 404, "NOT_FOUND"));
  const response = await list(request("/api/products/prd_a/qa"), productContext);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
