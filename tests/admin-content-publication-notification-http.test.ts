import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  moderated: {
    id: "cnt_1",
    serverId: "srv_1",
    status: "published",
    slug: "update-1",
    title: "Update 1",
    authorId: "usr_author",
  } as Record<string, unknown>,
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const moderateContent = vi.hoisted(() => vi.fn(async () => state.moderated));
const notifyFollowers = vi.hoisted(() =>
  vi.fn(async () => ({
    attempted: 1,
    delivered: 1,
    failed: 0,
  })),
);

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
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
    moderateContent,
  },
}));

vi.mock("../apps/web/src/lib/services/server-follow-notification-service", () => ({
  notifyServerFollowersOfPublishedContent: notifyFollowers,
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
}));

vi.mock("@nexus/security", () => ({
  can: vi.fn(() => true),
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { NextRequest } from "next/server";
import { POST } from "../apps/web/src/app/api/admin/actions/route";

function request(action: "publish" | "archive", extra: Record<string, unknown> = {}) {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: browserMutationHeaders({
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    }),
    body: JSON.stringify({
      expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
      targetType: "content",
      targetId: "cnt_1",
      action,
      notes: "Reviewed",
      ...extra,
    }),
  });
}

beforeEach(() => {
  stubBrowserMutationOrigin();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("content publication side effects", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    state.moderated = {
      id: "cnt_1",
      serverId: "srv_1",
      status: "published",
      slug: "update-1",
      title: "Update 1",
      authorId: "usr_author",
    };
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("schedules server follower fanout after a successful publish response", async () => {
    const response = await POST(request("publish"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      action: "publish",
      targetId: "cnt_1",
    });
    expect(moderateContent).toHaveBeenCalledTimes(1);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(notifyFollowers).not.toHaveBeenCalled();
    expect(state.afterCallbacks).toHaveLength(1);

    await state.afterCallbacks[0]?.();

    expect(notifyFollowers).toHaveBeenCalledTimes(1);
    expect(notifyFollowers).toHaveBeenCalledWith(state.moderated);
  });

  it("does not schedule follower fanout for archive", async () => {
    const response = await POST(request("archive"));

    expect(response.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
    expect(notifyFollowers).not.toHaveBeenCalled();
  });

  it("does not schedule fanout when published content is not server-linked", async () => {
    state.moderated = {
      ...state.moderated,
      serverId: null,
    };

    const response = await POST(request("publish"));

    expect(response.status).toBe(200);
    expect(afterMock).not.toHaveBeenCalled();
    expect(notifyFollowers).not.toHaveBeenCalled();
  });
});

it.each([
  { expectedUpdatedAt: undefined },
  { expectedUpdatedAt: "invalid" },
  { notes: " " },
  { expectedStatus: "draft" },
])(
  "requires the observed content revision, notes and strict authority fields %j",
  async (extra) => {
    const response = await POST(request("publish", extra));
    expect(response.status).toBe(400);
    expect(moderateContent).not.toHaveBeenCalled();
    expect(notifyFollowers).not.toHaveBeenCalled();
  },
);
