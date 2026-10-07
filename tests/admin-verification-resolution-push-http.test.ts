import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  resolution: {
    id: "ver_1",
    requesterId: "usr_requester",
    status: "approved",
  } as Record<string, unknown> | null,
}));

const afterMock = vi.hoisted(() => vi.fn());
const resolveRequest = vi.hoisted(() =>
  vi.fn(async () => state.resolution),
);
const findVerification = vi.hoisted(() =>
  vi.fn(async () => ({ id: "ver_1", status: "pending" })),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
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
    reviewBuild: vi.fn(),
    quarantineBuild: vi.fn(),
    restoreQuarantinedBuild: vi.fn(),
  },
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { moderateContent: vi.fn() },
}));

vi.mock(
  "../apps/web/src/lib/services/server-follow-notification-service",
  () => ({
    notifyServerFollowersOfPublishedContent: vi.fn(),
  }),
);

vi.mock("@nexus/db", () => ({
  productRepository: {
    updateWithAudit: vi.fn(),
    suspendPublished: vi.fn(),
    restoreSuspendedWithPublishedBuild: vi.fn(),
    findById: vi.fn(),
  },
  reportRepository: {
    resolve: vi.fn(),
    findById: vi.fn(),
  },
  verificationRepository: {
    resolveRequest,
    findById: findVerification,
  },
}));

vi.mock("@nexus/security", () => ({
  can: vi.fn(() => true),
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { NextRequest } from "next/server";
import { POST } from "../apps/web/src/app/api/admin/actions/route";

function request(action: "approve" | "reject") {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    },
    body: JSON.stringify({
      targetType: "verification",
      targetId: "ver_1",
      action,
      notes: "Verification evidence reviewed.",
    }),
  });
}

describe("verification resolution durable push scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.resolution = {
      id: "ver_1",
      requesterId: "usr_requester",
      status: "approved",
    };
  });

  it.each(["approve", "reject"] as const)(
    "keeps requester notification/outbox inside the committed %s resolution",
    async (action) => {
      state.resolution = {
        ...state.resolution,
        status: action === "approve" ? "approved" : "rejected",
      };

      const response = await POST(request(action));

      expect(response.status).toBe(200);
      expect(resolveRequest).toHaveBeenCalledWith(
        {
          id: "ver_1",
          reviewerId: "usr_mod",
          decision: action === "approve" ? "approved" : "rejected",
          reviewNotes: "Verification evidence reviewed.",
        },
        expect.objectContaining({
          targetId: "ver_1",
          targetType: "verification",
        }),
      );
      expect(afterMock).not.toHaveBeenCalled();
    },
  );

  it("does not schedule HTTP-side work when compare-and-set loses", async () => {
    state.resolution = null;

    const response = await POST(request("approve"));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "VERIFICATION_STATE_CHANGED",
    });
    expect(afterMock).not.toHaveBeenCalled();
  });
});
