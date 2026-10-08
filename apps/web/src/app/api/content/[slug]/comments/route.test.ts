import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  articleAuthorId: "usr_author",
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const dispatchNotifications = vi.hoisted(() =>
  vi.fn(async () => ({
    requested: 1,
    stored: 1,
    storageFailed: 0,
    push: {
      notifications: 1,
      attempted: 0,
      delivered: 0,
      failed: 0,
      stale: 0,
      deliveryErrors: 0,
    },
  })),
);
const getArticle = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "cnt_1",
    slug: "article-one",
    title: "Article One",
    authorId: state.articleAuthorId,
  })),
);
const addComment = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "cmt_1",
    contentId: "cnt_1",
    authorId: "usr_commenter",
    text: "Useful comment",
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

vi.mock("../../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_commenter",
      username: "commenter",
    })),
  },
}));

vi.mock("../../../../../lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug: getArticle,
    addComment,
  },
}));


vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: dispatchNotifications,
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(
    /^[0-9a-f-]{20,}$/u,
  );
}

function request() {
  return new NextRequest(
    "https://nexus.test/api/content/article-one/comments",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "nexus_session=test-session",
      },
      body: JSON.stringify({ text: "Useful comment" }),
    },
  );
}

describe("article comment notification side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    state.articleAuthorId = "usr_author";
  });

  it("returns the committed comment before author inbox and push delivery", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ slug: "article-one" }),
    });

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(addComment).toHaveBeenCalledOnce();
    expect(afterMock).toHaveBeenCalledOnce();
    expect(dispatchNotifications).not.toHaveBeenCalled();

    await state.afterCallbacks[0]?.();
    expect(dispatchNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "usr_author",
        category: "content",
      }),
    ]);
  });

  it("does not schedule a self-notification for the article author", async () => {
    state.articleAuthorId = "usr_commenter";
    const response = await POST(request(), {
      params: Promise.resolve({ slug: "article-one" }),
    });

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(afterMock).not.toHaveBeenCalled();
  });
});
