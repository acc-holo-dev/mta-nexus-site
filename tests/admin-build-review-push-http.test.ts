import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  storedNotifications: [
    {
      id: "ntf_build_review_bld_1_usr_1",
      recipientId: "usr_1",
      title: "Resource version approved",
      message: "Resource · 1.0.0",
      link: "/workspace/resources/prd_1",
    },
  ],
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const reviewBuild = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "bld_1",
    productId: "prd_1",
    status: "published",
  })),
);
const listBuildReviewByBuildId = vi.hoisted(() =>
  vi.fn(async () => state.storedNotifications),
);
const deliverStored = vi.hoisted(() =>
  vi.fn(async () => ({
    notifications: state.storedNotifications.length,
    attempted: 0,
    delivered: 0,
    failed: 0,
    stale: 0,
    deliveryErrors: 0,
  })),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: afterMock,
  };
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
  contentService: {
    moderateContent: vi.fn(),
  },
}));

vi.mock(
  "../apps/web/src/lib/services/server-follow-notification-service",
  () => ({
    notifyServerFollowersOfPublishedContent: vi.fn(),
  }),
);

vi.mock("../apps/web/src/lib/services/notification-web-push-service", () => ({
  deliverStoredNotificationsWebPush: deliverStored,
}));

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
    resolveRequest: vi.fn(),
    findById: vi.fn(),
  },
  notificationRepository: {
    listBuildReviewByBuildId,
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
    headers: {
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    },
    body: JSON.stringify({
      targetType: "build",
      targetId: "bld_1",
      action,
      notes: "Reviewed build",
    }),
  });
}

describe("build review push side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
  });

  it.each(["approve", "reject"] as const)(
    "schedules stored build-review notifications after %s commit",
    async (action) => {
      const response = await POST(request(action));

      expect(response.status).toBe(200);
      expect(reviewBuild).toHaveBeenCalledWith(
        {
          buildId: "bld_1",
          decision: action,
          notes: "Reviewed build",
        },
        expect.objectContaining({ id: "usr_mod" }),
      );
      expect(afterMock).toHaveBeenCalledTimes(1);
      expect(listBuildReviewByBuildId).not.toHaveBeenCalled();
      expect(deliverStored).not.toHaveBeenCalled();

      await state.afterCallbacks[0]?.();

      expect(listBuildReviewByBuildId).toHaveBeenCalledWith("bld_1");
      expect(deliverStored).toHaveBeenCalledWith(
        state.storedNotifications,
      );
    },
  );

  it("does not schedule build-review push for quarantine", async () => {
    const response = await POST(request("quarantine"));

    expect(response.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
    expect(listBuildReviewByBuildId).not.toHaveBeenCalled();
    expect(deliverStored).not.toHaveBeenCalled();
  });
});
