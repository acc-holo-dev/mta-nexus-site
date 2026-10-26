import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "cnt_a",
}));
vi.mock("@nexus/db", () => ({
  contentRepository: { listPublished: vi.fn(), createWithAudit: vi.fn() },
  organizationRepository: { findById: vi.fn(), listUserMemberships: vi.fn() },
  productRepository: { findById: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { getServerById: vi.fn(), canManageServer: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { canManageProduct: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug: vi.fn(),
    addComment: vi.fn(),
    pageDiscussion: vi.fn(),
    manageComment: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/content-reaction-service", () => ({
  contentReactionService: { state: vi.fn(), set: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/discussion-follow-notification-service", () => ({
  notifyDiscussionReplies: vi.fn(),
}));

import { POST as createContent } from "../apps/web/src/app/api/content/route";
import { POST as createComment } from "../apps/web/src/app/api/content/[slug]/comments/route";
import {
  DELETE as deleteComment,
  PATCH as editComment,
} from "../apps/web/src/app/api/content/[slug]/comments/[id]/route";
import { PUT as setReaction } from "../apps/web/src/app/api/content/[slug]/reactions/route";

const context = { params: Promise.resolve({ slug: "article", id: "cmt_a" }) };
const mutations = [
  ["content create", "POST", createContent, undefined],
  ["comment create", "POST", createComment, context],
  ["comment edit", "PATCH", editComment, context],
  ["comment delete", "DELETE", deleteComment, context],
  ["content reaction", "PUT", setReaction, context],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/content", {
    method,
    headers: {
      cookie: "nexus_session=writer",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ text: "A public note" }),
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

describe("public content handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler, routeContext) => {
      const input = request(method);
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler, routeContext) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler, routeContext) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        routeContext as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
