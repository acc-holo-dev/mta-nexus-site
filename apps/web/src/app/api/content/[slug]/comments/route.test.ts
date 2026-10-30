import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getArticle = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "cnt_1",
    slug: "article-one",
    title: "Article One",
    authorId: "usr_author",
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

import { NextRequest } from "next/server";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../../../tests/browser-mutation-headers";
import { POST } from "./route";

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

function request() {
  return new NextRequest("https://nexus.test/api/content/article-one/comments", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=test-session",
    },
    body: JSON.stringify({ text: "Useful comment" }),
  });
}

describe("article comment HTTP behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("commits the comment without a post-commit notification callback", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ slug: "article-one" }),
    });

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(addComment).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({
      comment: { id: "cmt_1", contentId: "cnt_1" },
    });
  });
});
