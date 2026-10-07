import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  resolution: {
    id: "ver_1",
    requesterId: "usr_requester",
    status: "approved",
  } as Record<string, unknown> | null,
  stored: {
    id: "ntf_verification_resolution_ver_1",
    recipientId: "usr_requester",
    title: "Verification approved",
    message: "user verification for usr_requester was approved.",
    type: "security",
    category: "security",
    isRead: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  } as Record<string, unknown> | null,
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const resolveRequest = vi.hoisted(() =>
  vi.fn(async () => state.resolution),
);
const findVerification = vi.hoisted(() =>
  vi.fn(async () => ({ id: "ver_1", status: "pending" })),
);
const findNotification = vi.hoisted(() =>
  vi.fn(async () => state.stored),
);
const deliverStored = vi.hoisted(() =>
  vi.fn(async () => ({
    notifications: state.stored ? 1 : 0,
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
    reviewBuild: vi.fn(),
    quarantineBuild: vi.fn(),
    restoreQuarantinedBuild: vi.fn(),
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
    resolveRequest,
    findById: findVerification,
  },
  notificationRepository: {
    findById: findNotification,
    listBuildReviewByBuildId: vi.fn(async () => []),
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

describe("verification resolution push side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    state.resolution = {
      id: "ver_1",
      requesterId: "usr_requester",
      status: "approved",
    };
    state.stored = {
      id: "ntf_verification_resolution_ver_1",
      recipientId: "usr_requester",
      title: "Verification approved",
      message: "user verification for usr_requester was approved.",
      type: "security",
      category: "security",
      isRead: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  });

  it.each(["approve", "reject"] as const)(
    "schedules the committed requester notification after %s",
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
      expect(afterMock).toHaveBeenCalledTimes(1);
      expect(findNotification).not.toHaveBeenCalled();
      expect(deliverStored).not.toHaveBeenCalled();

      await state.afterCallbacks[0]?.();

      expect(findNotification).toHaveBeenCalledWith(
        "ntf_verification_resolution_ver_1",
      );
      expect(deliverStored).toHaveBeenCalledWith([state.stored]);
    },
  );

  it("keeps a missing post-commit row from becoming a push error", async () => {
    state.stored = null;

    const response = await POST(request("approve"));
    expect(response.status).toBe(200);

    await state.afterCallbacks[0]?.();

    expect(findNotification).toHaveBeenCalledOnce();
    expect(deliverStored).not.toHaveBeenCalled();
  });

  it("does not schedule push when the verification state transition lost its compare-and-set", async () => {
    state.resolution = null;

    const response = await POST(request("approve"));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "VERIFICATION_STATE_CHANGED",
    });
    expect(afterMock).not.toHaveBeenCalled();
    expect(findNotification).not.toHaveBeenCalled();
    expect(deliverStored).not.toHaveBeenCalled();
  });
});
