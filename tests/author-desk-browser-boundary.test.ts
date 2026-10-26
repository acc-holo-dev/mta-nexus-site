import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "cnt_a",
}));
vi.mock("@nexus/db", () => ({
  authorContentRepository: { pageByAuthor: vi.fn(), findAuthored: vi.fn(), mutate: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/author-content-service", () => ({
  authorContentService: { create: vi.fn(), update: vi.fn(), get: vi.fn(), restore: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/discussion-workspace-service", () => ({
  discussionWorkspaceService: { own: vi.fn(), mutate: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/content-reaction-service", () => ({
  contentReactionService: { remove: vi.fn() },
}));

import { POST as createContent } from "../apps/web/src/app/api/workspace/content/route";
import {
  DELETE as archiveContent,
  PATCH as editContent,
} from "../apps/web/src/app/api/workspace/content/[id]/route";
import { POST as restoreContent } from "../apps/web/src/app/api/workspace/content/[id]/restore/route";
import {
  DELETE as deleteDiscussion,
  PATCH as editDiscussion,
} from "../apps/web/src/app/api/workspace/discussions/[id]/route";
import { DELETE as removeReaction } from "../apps/web/src/app/api/workspace/reactions/[id]/route";

const context = { params: Promise.resolve({ id: "cnt_a" }) };
const mutations = [
  ["content create", "POST", createContent],
  ["content edit", "PATCH", editContent],
  ["content archive", "DELETE", archiveContent],
  ["content restore", "POST", restoreContent],
  ["discussion edit", "PATCH", editDiscussion],
  ["discussion delete", "DELETE", deleteDiscussion],
  ["reaction removal", "DELETE", removeReaction],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/workspace/content", {
    method,
    headers: {
      cookie: "nexus_session=writer",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ title: "Desk note" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("author desk handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler) => {
      const input = request(method);
      const response = await handler(input, context as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, context as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        context as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
