import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

export const userPlatformHttpNow = new Date("2026-10-10T12:00:00Z");

export const userPlatformHttpState = {
  user: null as Record<string, unknown> | null,
};

export const userPlatformHttpMocks = {
  create: vi.fn(),
  mutate: vi.fn(),
  find: vi.fn(),
  page: vi.fn(),
  profile: vi.fn(),
  rate: vi.fn(),
};

export const userPlatformHttpContentContext = { params: Promise.resolve({ id: "cnt_author" }) };

export const userPlatformHttpContentInput = {
  title: "Author publication",
  slug: "author-publication",
  body: "A complete publication body.",
  type: "article",
  tags: [],
  excerpt: "",
  coverImageUrl: "",
};

export function userPlatformHttpRequest(
  method: string,
  body?: unknown,
  locale = "en",
  headers: Record<string, string> = {},
) {
  return new NextRequest("http://nexus.test/api/workspace/content?page=2&q=hello&status=draft", {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test; nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function installUserPlatformHttpLifecycle() {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    userPlatformHttpState.user = {
      id: "usr_author",
      username: "author",
      displayName: "Writer",
      updatedAt: userPlatformHttpNow,
      role: "user",
      email: "private@example.test",
      passwordHash: "secret",
      isVerified: false,
    };
    userPlatformHttpMocks.rate.mockResolvedValue({ success: true });
    userPlatformHttpMocks.create.mockImplementation(async (data) => ({
      ...data,
      createdAt: userPlatformHttpNow,
      updatedAt: userPlatformHttpNow,
    }));
    userPlatformHttpMocks.find.mockResolvedValue({
      ...userPlatformHttpContentInput,
      id: "cnt_author",
      status: "draft",
      authorId: "usr_author",
      updatedAt: userPlatformHttpNow,
    });
    userPlatformHttpMocks.mutate.mockImplementation(
      async (id, authorId, _date, _status, fields) => ({
        ...userPlatformHttpContentInput,
        ...fields,
        id,
        authorId,
        status: fields ? "draft" : "archived",
        updatedAt: new Date(userPlatformHttpNow.getTime() + 1),
      }),
    );
    userPlatformHttpMocks.page.mockResolvedValue({ items: [], page: 2, hasMore: false });
    userPlatformHttpMocks.profile.mockImplementation(async (_id, _date, fields) => ({
      ...userPlatformHttpState.user,
      ...fields,
      updatedAt: new Date(userPlatformHttpNow.getTime() + 1),
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
