import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_test",
}));
vi.mock("@nexus/db", () => ({
  productRepository: {},
  reportRepository: {},
  verificationRepository: {},
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: {} }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));
vi.mock("../apps/web/src/lib/services/server-follow-notification-service", () => ({
  notifyServerFollowersOfPublishedContent: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  resourceModerationService: {},
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: {},
}));
vi.mock("../apps/web/src/lib/services/community-report-service", () => ({
  communityReportService: {},
}));
vi.mock("../apps/web/src/lib/services/community-report-notifications", () => ({
  queueCommunityReportNotice: vi.fn(),
  queueCommunityReportBatchNotices: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/license-control-service", () => ({
  licenseControlService: {},
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: {},
}));

import { POST as adminAction } from "../apps/web/src/app/api/admin/actions/route";
import { POST as communityCommand } from "../apps/web/src/app/api/admin/community/[id]/route";
import { POST as removeDiscussion } from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/route";
import { POST as discussionPreview } from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/preview/route";
import { POST as discussionBatch } from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/route";
import { POST as publicationPreview } from "../apps/web/src/app/api/admin/community/[id]/reports/batch/preview/route";
import { POST as publicationBatch } from "../apps/web/src/app/api/admin/community/[id]/reports/batch/route";
import { POST as licenseModerate } from "../apps/web/src/app/api/admin/licenses/[id]/route";
import { PATCH as reportDecision } from "../apps/web/src/app/api/admin/reports/[id]/route";
import { POST as resourceModerate } from "../apps/web/src/app/api/admin/resources/[id]/route";
import { PATCH as verificationDecision } from "../apps/web/src/app/api/admin/verification/[id]/route";

const context = { params: Promise.resolve({ id: "mod_1", commentId: "cmt_1" }) };
const mutations = [
  ["admin actions", "POST", adminAction],
  ["community command", "POST", communityCommand],
  ["discussion removal", "POST", removeDiscussion],
  ["discussion report preview", "POST", discussionPreview],
  ["discussion report batch", "POST", discussionBatch],
  ["publication report preview", "POST", publicationPreview],
  ["publication report batch", "POST", publicationBatch],
  ["license moderation", "POST", licenseModerate],
  ["report decision", "PATCH", reportDecision],
  ["resource moderation", "POST", resourceModerate],
  ["verification decision", "PATCH", verificationDecision],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/admin/moderation", {
    method,
    headers: {
      cookie: "nexus_session=staff",
      "content-type": "application/json",
      ...headers,
    },
    body: "{}",
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

describe("staff moderation handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler) => {
      const input = request(method);
      const response = await handler(input, context);
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
      const response = await handler(input, context);
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
        context,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
