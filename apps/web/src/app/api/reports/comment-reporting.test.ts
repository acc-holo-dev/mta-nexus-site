import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
}));
const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  findComment: vi.fn(),
  createWithAudit: vi.fn(),
  moderators: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: afterMock };
});
vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));
vi.mock("@nexus/security", () => ({
  can: vi.fn(() => false),
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_test`,
}));
vi.mock("@nexus/db", () => ({
  reportRepository: {
    createWithAudit: mocks.createWithAudit,
    listPage: vi.fn(),
  },
  productRepository: { findById: vi.fn() },
  serverRepository: { findById: vi.fn() },
  contentRepository: {
    findById: vi.fn(),
    findCommentById: mocks.findComment,
  },
  userRepository: {
    findById: vi.fn(),
    listModeratorIds: mocks.moderators,
  },
}));

import { POST } from "./route";

function request(targetId = "cmt_1") {
  return new NextRequest("https://nexus.test/api/reports", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=test",
    },
    body: JSON.stringify({
      targetType: "comment",
      targetId,
      type: "abuse",
      reason: "This comment contains abusive material.",
    }),
  });
}

describe("comment abuse reporting", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    mocks.session.mockResolvedValue({ id: "usr_reporter" });
    mocks.rate.mockResolvedValue({ success: true });
    mocks.findComment.mockResolvedValue({ id: "cmt_1" });
    mocks.createWithAudit.mockResolvedValue({
      created: true,
      report: { id: "rpt_test", status: "open" },
    });
    mocks.moderators.mockResolvedValue([]);
    mocks.dispatch.mockResolvedValue({
      requested: 0,
      stored: 0,
      storageFailed: 0,
      push: {
        notifications: 0,
        attempted: 0,
        delivered: 0,
        failed: 0,
        stale: 0,
        deliveryErrors: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a report only after the comment target exists", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.findComment).toHaveBeenCalledWith("cmt_1");
    expect(mocks.createWithAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterId: "usr_reporter",
        targetType: "comment",
        targetId: "cmt_1",
      }),
      expect.objectContaining({ action: "report.created" }),
    );
  });

  it("returns 404 and performs no write when the comment is missing", async () => {
    mocks.findComment.mockResolvedValueOnce(null);
    const response = await POST(request("cmt_missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: "Report target was not found",
    });
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported target types before target lookup", async () => {
    const response = await POST(
      new NextRequest("https://nexus.test/api/reports", {
        method: "POST",
        headers: {
          ...browserMutationHeaders(),
          "content-type": "application/json",
          cookie: "nexus_session=test",
        },
        body: JSON.stringify({
          targetType: "message",
          targetId: "cmt_1",
          type: "abuse",
          reason: "Unsupported target type should fail validation.",
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.findComment).not.toHaveBeenCalled();
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });
});
