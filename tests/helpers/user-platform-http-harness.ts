import { afterEach, beforeEach, vi } from "vitest";
import { stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared clock for user-platform HTTP suites. */
export const userPlatformHttpNow = new Date("2026-10-10T12:00:00Z");

/** Shared mutable session fixture for user-platform HTTP suites. */
export const userPlatformHttpState = {
  user: null as Record<string, unknown> | null,
};

/** Shared service mocks for user-platform HTTP suites. */
export const userPlatformHttpMocks = {
  create: vi.fn(),
  mutate: vi.fn(),
  find: vi.fn(),
  page: vi.fn(),
  profile: vi.fn(),
  rate: vi.fn(),
};

/** Canonical author content payload used across create/edit assertions. */
export const userPlatformHttpInput = {
  title: "Author publication",
  slug: "author-publication",
  body: "A complete publication body.",
  type: "article",
  tags: [] as string[],
  excerpt: "",
  coverImageUrl: "",
};

/** Route context for `/api/workspace/content/[id]`. */
export const userPlatformHttpContext = {
  params: Promise.resolve({ id: "cnt_author" }),
};

/** Factory for auth-service mock from suite files under `tests/`. */
export function createUserPlatformHttpAuthMock() {
  return {
    authService: { getSession: async () => userPlatformHttpState.user },
  };
}

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createUserPlatformHttpDbMock() {
  return {
    authorContentRepository: {
      findAuthored: userPlatformHttpMocks.find,
      mutate: userPlatformHttpMocks.mutate,
      pageByAuthor: userPlatformHttpMocks.page,
    },
    contentRepository: { createWithAudit: userPlatformHttpMocks.create },
    userRepository: { updatePublicProfile: userPlatformHttpMocks.profile },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `tests/`. */
export function createUserPlatformHttpSecurityMock() {
  return {
    consumeRateLimit: userPlatformHttpMocks.rate,
    generateId: (prefix: string) => `${prefix}_generated`,
  };
}

export function installUserPlatformHttpHooks() {
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
      ...userPlatformHttpInput,
      id: "cnt_author",
      status: "draft",
      authorId: "usr_author",
      updatedAt: userPlatformHttpNow,
    });
    userPlatformHttpMocks.mutate.mockImplementation(
      async (id, authorId, _date, _status, fields) => ({
        ...userPlatformHttpInput,
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
