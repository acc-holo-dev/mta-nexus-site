import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../tests/browser-mutation-headers";

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
  listByRequester: vi.fn(),
  moderators: vi.fn(),
  dispatch: vi.fn(),
  findOrganization: vi.fn(),
  memberships: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("../../../lib/services/auth-service", () => ({
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
    listByRequester: mocks.listByRequester,
  },
  userRepository: { listModeratorIds: mocks.moderators },
  organizationRepository: {
    findById: mocks.findOrganization,
    listUserMemberships: mocks.memberships,
  },
}));

vi.mock("../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));

import { GET, POST } from "./route";

function postRequest(body: unknown = { targetType: "user", targetId: "u_1" }) {
  const request = new NextRequest("https://nexus.test/api/verification", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  request.cookies.set("nexus_session", "session");
  return request;
}

function getRequest() {
  const request = new NextRequest("https://nexus.test/api/verification");
  request.cookies.set("nexus_session", "session");
  return request;
}

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.afterCallbacks.length = 0;
  state.user = { id: "u_1", isVerified: false };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.findPending.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    id: "ver_test",
    status: "pending",
  });
  mocks.listByRequester.mockResolvedValue([]);
  mocks.moderators.mockResolvedValue(["mod_1", "mod_2"]);
  mocks.dispatch.mockResolvedValue({
    requested: 2,
    stored: 2,
    storageFailed: 0,
    push: {
      notifications: 2,
      attempted: 0,
      delivered: 0,
      failed: 0,
      stale: 0,
      deliveryErrors: 0,
    },
  });
  mocks.findOrganization.mockResolvedValue(null);
  mocks.memberships.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verification HTTP behavior", () => {
  it("keeps unauthenticated and authenticated history reads private", async () => {
    state.user = null;
    const denied = await GET(getRequest());
    expect(denied.status).toBe(401);
    expectPrivate(denied);

    state.user = { id: "u_1", isVerified: false };
    mocks.listByRequester.mockResolvedValue([{ id: "ver_history", status: "approved" }]);
    const allowed = await GET(getRequest());
    expect(allowed.status).toBe(200);
    expectPrivate(allowed);
    expect(await allowed.json()).toEqual({
      requests: [{ id: "ver_history", status: "approved" }],
    });
    expect(mocks.listByRequester).toHaveBeenCalledWith("u_1");
  });

  it("commits the application before moderator notification dispatch", async () => {
    const response = await POST(postRequest());

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: "u_1",
        targetType: "user",
        targetId: "u_1",
      }),
      expect.objectContaining({
        action: "verification.requested",
      }),
    );
    expect(afterMock).toHaveBeenCalledOnce();
    expect(mocks.moderators).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();

    await state.afterCallbacks[0]?.();

    expect(mocks.moderators).toHaveBeenCalledOnce();
    expect(mocks.dispatch).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "mod_1",
        type: "security",
      }),
      expect.objectContaining({
        recipientId: "mod_2",
        type: "security",
      }),
    ]);
  });

  it("keeps a committed application successful when moderator lookup fails", async () => {
    mocks.moderators.mockRejectedValueOnce(new Error("moderator lookup unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const response = await POST(postRequest());
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        success: true,
        request: { id: "ver_test" },
      });

      await state.afterCallbacks[0]?.();

      expect(mocks.create).toHaveBeenCalledOnce();
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledOnce();
    } finally {
      warning.mockRestore();
    }
  });

  it("reports partial moderator inbox storage without changing the committed request", async () => {
    mocks.dispatch.mockResolvedValueOnce({
      requested: 2,
      stored: 1,
      storageFailed: 1,
      push: {
        notifications: 1,
        attempted: 0,
        delivered: 0,
        failed: 0,
        stale: 0,
        deliveryErrors: 0,
      },
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const response = await POST(postRequest());
      expect(response.status).toBe(201);
      await state.afterCallbacks[0]?.();

      expect(warning).toHaveBeenCalledOnce();
      const line = String(warning.mock.calls[0]?.[0] ?? "");
      expect(line).toContain("verification.moderator_notification_partial_failure");
      expect(line).toContain('"storageFailed":1');
    } finally {
      warning.mockRestore();
    }
  });

  it("rejects verification of another user profile before duplicate or write checks", async () => {
    const response = await POST(
      postRequest({
        targetType: "user",
        targetId: "u_other",
      }),
    );

    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(await response.json()).toEqual({
      error: "You can only verify your own profile",
    });
    expect(mocks.findPending).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("forces server ownership through the dedicated MTA control challenge", async () => {
    const response = await POST(
      postRequest({
        targetType: "server",
        targetId: "srv_1",
      }),
    );

    expect(response.status).toBe(422);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({
      code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
    });
    expect(mocks.findPending).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("returns the canonical pending request for a duplicate target", async () => {
    mocks.findPending.mockResolvedValueOnce({
      id: "ver_existing",
      status: "pending",
    });

    const response = await POST(postRequest());

    expect(response.status).toBe(409);
    expectPrivate(response);
    expect(await response.json()).toEqual({
      error: "A verification request is already pending",
      requestId: "ver_existing",
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects already-verified targets before creating another request", async () => {
    state.user = { id: "u_1", isVerified: true };

    const response = await POST(postRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This target is already verified",
    });
    expect(mocks.findPending).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects unsafe proof schemes and oversized target IDs before writes", async () => {
    for (const body of [
      {
        targetType: "user",
        targetId: "u_1",
        proofUrl: "javascript:alert(1)",
      },
      {
        targetType: "user",
        targetId: "x".repeat(129),
      },
    ]) {
      const response = await POST(postRequest(body));
      expect(response.status).toBe(400);
      expectPrivate(response);
    }
    expect(mocks.create).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("does not schedule moderator delivery when the application transaction fails", async () => {
    mocks.create.mockRejectedValueOnce(new Error("insert failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await POST(postRequest());
      expect(response.status).toBe(500);
      expectPrivate(response);
      expect(afterMock).not.toHaveBeenCalled();
      expect(mocks.moderators).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
