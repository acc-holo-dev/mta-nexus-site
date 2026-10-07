import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  user: { id: "u_1", isVerified: false } as {
    id: string;
    isVerified: boolean;
  } | null,
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);

const mocks = vi.hoisted(() => ({
  rate: vi.fn(),
  findPending: vi.fn(),
  create: vi.fn(),
  moderators: vi.fn(),
  notify: vi.fn(),
  push: vi.fn(),
}));

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
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_test`,
}));
vi.mock("@nexus/db", () => ({
  verificationRepository: {
    findPendingForTarget: mocks.findPending,
    createRequest: mocks.create,
  },
  userRepository: { listModeratorIds: mocks.moderators },
  notificationRepository: { create: mocks.notify },
  organizationRepository: {},
}));
vi.mock("../apps/web/src/lib/services/notification-web-push-service", () => ({
  deliverStoredNotificationsWebPush: mocks.push,
}));

import { POST } from "../apps/web/src/app/api/verification/route";

function request(body: unknown = { targetType: "user", targetId: "u_1" }) {
  const req = new NextRequest("https://nexus.test/api/verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  req.cookies.set("nexus_session", "session");
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.afterCallbacks.length = 0;
  state.user = { id: "u_1", isVerified: false };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.findPending.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ id: "ver_test", status: "pending" });
  mocks.moderators.mockResolvedValue(["mod_1", "mod_2"]);
  mocks.notify.mockImplementation(async (input) => ({
    ...input,
    createdAt: new Date(),
    isRead: false,
  }));
  mocks.push.mockResolvedValue({
    notifications: 2,
    attempted: 0,
    delivered: 0,
    failed: 0,
    stale: 0,
    deliveryErrors: 0,
  });
});

describe("verification notification delivery", () => {
  it("commits the application before scheduling moderator inbox and push delivery", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ requesterId: "u_1", targetId: "u_1" }),
      expect.objectContaining({ action: "verification.requested" }),
    );
    expect(afterMock).toHaveBeenCalledOnce();
    expect(mocks.moderators).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    await state.afterCallbacks[0]?.();

    expect(mocks.moderators).toHaveBeenCalledOnce();
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "mod_2" }),
    );
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("reports a saved application as successful even when notification lookup fails", async () => {
    mocks.moderators.mockRejectedValueOnce(
      new Error("Delivery database unavailable"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        success: true,
        request: { id: "ver_test" },
      });

      await state.afterCallbacks[0]?.();

      expect(mocks.create).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledOnce();
      expect(mocks.push).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("pushes only successfully stored moderator notifications", async () => {
    mocks.notify
      .mockResolvedValueOnce({
        id: "not_1",
        recipientId: "mod_1",
        title: "New verification request",
        message: "user verification requested for u_1",
        link: "/admin?verificationView=pending&verificationPage=1",
        type: "security",
        createdAt: new Date(),
        isRead: false,
      })
      .mockRejectedValueOnce(new Error("Recipient storage unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(201);

      await state.afterCallbacks[0]?.();

      expect(mocks.notify).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(
        "Verification notification delivery failures:",
        1,
      );
      expect(mocks.push).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "not_1",
          recipientId: "mod_1",
        }),
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not schedule notifications if the application was not saved", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Insert failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(500);
      expect(afterMock).not.toHaveBeenCalled();
      expect(mocks.moderators).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("rejects unsafe proof schemes and excessive target IDs before creating a request", async () => {
    expect(
      (
        await POST(
          request({
            targetType: "user",
            targetId: "u_1",
            proofUrl: "javascript:alert(1)",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({
            targetType: "user",
            targetId: "x".repeat(129),
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });
});
