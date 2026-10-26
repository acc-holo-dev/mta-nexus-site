import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const afterMock = vi.hoisted(() => vi.fn());
const reviewBuild = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "bld_1",
    productId: "prd_1",
    status: "published",
  })),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: afterMock };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_mod",
      username: "moderator",
      role: "moderator",
    })),
  },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    reviewBuild,
    quarantineBuild: vi.fn(async () => ({ id: "bld_1" })),
    restoreQuarantinedBuild: vi.fn(async () => ({ id: "bld_1" })),
  },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { moderateContent: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/server-follow-notification-service", () => ({
  notifyServerFollowersOfPublishedContent: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  productRepository: {
    updateWithAudit: vi.fn(),
    suspendPublished: vi.fn(),
    restoreSuspendedWithPublishedBuild: vi.fn(),
    findById: vi.fn(),
  },
  reportRepository: { resolve: vi.fn(), findById: vi.fn() },
  verificationRepository: {
    resolveRequest: vi.fn(),
    findById: vi.fn(),
  },
}));
vi.mock("@nexus/security", () => ({
  can: vi.fn(() => true),
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { NextRequest } from "next/server";
import { POST } from "../apps/web/src/app/api/admin/actions/route";

function request(action: "approve" | "reject" | "quarantine") {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: browserMutationHeaders({
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    }),
    body: JSON.stringify({
      targetType: "build",
      targetId: "bld_1",
      expectedRevision: 1,
      action,
      notes: "Reviewed build",
    }),
  });
}

describe("build review durable push scheduling", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["approve", "reject"] as const)(
    "leaves push scheduling inside the committed review transaction for %s",
    async (action) => {
      const response = await POST(request(action));
      expect(response.status).toBe(200);
      expect(reviewBuild).toHaveBeenCalledWith(
        {
          buildId: "bld_1",
          decision: action,
          expectedRevision: 1,
          notes: "Reviewed build",
        },
        expect.objectContaining({ id: "usr_mod" }),
      );
      expect(afterMock).not.toHaveBeenCalled();
    },
  );

  it("does not add an HTTP-side push task for quarantine", async () => {
    const response = await POST(request("quarantine"));
    expect(response.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
  });
});
