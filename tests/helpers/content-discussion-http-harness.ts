import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

export const contentDiscussionHttpState = {
  actor: { id: "commenter", username: "writer" } as Record<string, unknown> | null,
  after: [] as (() => Promise<unknown>)[],
  registrationFails: false,
};

export const contentDiscussionHttpMocks = {
  article: vi.fn(),
  page: vi.fn(),
  add: vi.fn(),
  parent: vi.fn(),
  rate: vi.fn(),
  notify: vi.fn(),
};

export const contentDiscussionHttpContext = { params: Promise.resolve({ slug: "article" }) };
export const contentDiscussionHttpIntent = "12345678-1234-4234-8234-123456789abc";

export function contentDiscussionHttpRequest(
  method: string,
  body?: unknown,
  query = "",
  locale = "en",
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://nexus.test/api/content/article/comments${query}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : browserMutationHeaders()),
      cookie: `nexus_locale=${locale};nexus_session=test`,
      "content-type": "application/json",
      ...(method === "POST"
        ? { "Idempotency-Key": contentDiscussionHttpIntent, "x-nexus-actor-id": "commenter" }
        : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function installContentDiscussionHttpLifecycle() {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    contentDiscussionHttpState.actor = { id: "commenter", username: "writer" };
    contentDiscussionHttpState.after = [];
    contentDiscussionHttpState.registrationFails = false;
    contentDiscussionHttpMocks.article.mockResolvedValue({
      id: "content",
      slug: "article",
      title: "Article",
      authorId: "author",
    });
    contentDiscussionHttpMocks.page.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
    });
    contentDiscussionHttpMocks.add.mockImplementation(async (input) => ({
      comment: {
        ...input,
        id: "comment",
        authorId: "commenter",
      },
      replayed: false,
    }));
    contentDiscussionHttpMocks.parent.mockResolvedValue("parentAuthor");
    contentDiscussionHttpMocks.rate.mockResolvedValue({ success: true });
    contentDiscussionHttpMocks.notify.mockResolvedValue({ stored: 1 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
