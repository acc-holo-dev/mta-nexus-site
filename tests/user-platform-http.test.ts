import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const now = new Date("2026-10-10T12:00:00Z");
const state = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  mutate: vi.fn(),
  find: vi.fn(),
  page: vi.fn(),
  profile: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/db", () => ({
  authorContentRepository: {
    findAuthored: mocks.find,
    mutate: mocks.mutate,
    pageByAuthor: mocks.page,
  },
  contentRepository: { createWithAudit: mocks.create },
  userRepository: { updatePublicProfile: mocks.profile },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_generated`,
}));
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import {
  GET as profileGet,
  PATCH as profilePatch,
} from "../apps/web/src/app/api/account/profile/route";
import { GET as list, POST as create } from "../apps/web/src/app/api/workspace/content/route";
import {
  GET as get,
  PATCH as update,
  DELETE as archive,
} from "../apps/web/src/app/api/workspace/content/[id]/route";
const context = { params: Promise.resolve({ id: "cnt_author" }) };
const input = {
  title: "Author publication",
  slug: "author-publication",
  body: "A complete publication body.",
  type: "article",
  tags: [],
  excerpt: "",
  coverImageUrl: "",
};
function request(method: string, body?: unknown, locale = "en", headers = {}) {
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
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.user = {
    id: "usr_author",
    username: "author",
    displayName: "Writer",
    updatedAt: now,
    role: "user",
    email: "private@example.test",
    passwordHash: "secret",
    isVerified: false,
  };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.create.mockImplementation(async (data) => ({ ...data, createdAt: now, updatedAt: now }));
  mocks.find.mockResolvedValue({
    ...input,
    id: "cnt_author",
    status: "draft",
    authorId: "usr_author",
    updatedAt: now,
  });
  mocks.mutate.mockImplementation(async (id, authorId, _date, _status, fields) => ({
    ...input,
    ...fields,
    id,
    authorId,
    status: fields ? "draft" : "archived",
    updatedAt: new Date(now.getTime() + 1),
  }));
  mocks.page.mockResolvedValue({ items: [], page: 2, hasMore: false });
  mocks.profile.mockImplementation(async (_id, _date, fields) => ({
    ...state.user,
    ...fields,
    updatedAt: new Date(now.getTime() + 1),
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it.each(["en", "ru"])("uses private cache and a safe account projection in %s", async (locale) => {
  const response = await profileGet(request("GET", undefined, locale));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual({
    profile: {
      id: "usr_author",
      username: "author",
      displayName: "Writer",
      bio: "",
      avatarUrl: "",
      updatedAt: now.toISOString(),
    },
  });
});
it("localizes unauthenticated failures and performs no writes", async () => {
  state.user = null;
  const response = await create(request("POST", input, "ru"));
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({
    code: "UNAUTHORIZED",
    error: "Войдите снова, чтобы продолжить.",
  });
  expect(mocks.create).not.toHaveBeenCalled();
});
it("scopes the author's private list to the session and normalizes paging", async () => {
  await list(request("GET"));
  expect(mocks.page).toHaveBeenCalledWith("usr_author", {
    page: 2,
    query: "hello",
    status: "draft",
  });
});
it.each(["article", "news", "devlog", "update", "announcement"])(
  "sends %s to moderation regardless of actor role",
  async (type) => {
    if (state.user) state.user.role = "admin";
    const response = await create(request("POST", { ...input, type }));
    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      type,
      status: "draft",
      authorId: "usr_author",
    });
  },
);
it.each(["post", "question"])(
  "publishes a new %s through the canonical server policy",
  async (type) => {
    expect((await create(request("POST", { ...input, type }))).status).toBe(201);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      status: "published",
      publishedAt: expect.any(Date),
    });
  },
);
it.each([
  { status: "published" },
  { authorId: "usr_other" },
  { organizationId: "org_other" },
  { productId: "prd_other" },
])("rejects client-controlled authority: %j", async (fields) => {
  expect((await create(request("POST", { ...input, ...fields }))).status).toBe(422);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("maps a duplicate URL to a localized conflict", async () => {
  mocks.create.mockRejectedValue({ cause: { code: "23505" } });
  const response = await create(request("POST", input));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "SLUG_CONFLICT" });
});
it("does not disclose another author's private detail", async () => {
  mocks.find.mockResolvedValue(null);
  const response = await get(request("GET"), context);
  expect(response.status).toBe(404);
  expect(mocks.find).toHaveBeenCalledWith("cnt_author", "usr_author");
});
it("passes version and immutable author scope to transactional edits", async () => {
  const { slug: _slug, type: _type, ...fields } = input;
  expect(
    (
      await update(
        request("PATCH", {
          ...fields,
          expectedUpdatedAt: now.toISOString(),
          expectedStatus: "draft",
        }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(mocks.mutate).toHaveBeenCalledWith(
    "cnt_author",
    "usr_author",
    now,
    "draft",
    expect.objectContaining(fields),
    expect.objectContaining({ action: "content.edited_by_author", actorId: "usr_author" }),
  );
});
it("requires a version for editing and blocks immutable target changes", async () => {
  expect((await update(request("PATCH", input), context)).status).toBe(422);
  expect(
    (await update(request("PATCH", { ...input, expectedUpdatedAt: now.toISOString() }), context))
      .status,
  ).toBe(422);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("archives with an explicit version and does not delete content or discussion data", async () => {
  expect(
    (
      await archive(
        request("DELETE", { expectedUpdatedAt: now.toISOString(), expectedStatus: "draft" }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(mocks.mutate.mock.calls[0]).toEqual([
    "cnt_author",
    "usr_author",
    now,
    "draft",
    null,
    expect.objectContaining({ action: "content.archived_by_author" }),
  ]);
});
it.each(["CONFLICT", "CONTENT_ARCHIVED", "FORBIDDEN"])(
  "preserves repository failure %s",
  async (code) => {
    mocks.mutate.mockRejectedValue(
      new AppError("internal details", code === "FORBIDDEN" ? 403 : 409, code),
    );
    const response = await archive(
      request("DELETE", { expectedUpdatedAt: now.toISOString(), expectedStatus: "draft" }, "ru"),
      context,
    );
    expect(await response.json()).toMatchObject({ code });
  },
);
it("allows only the editable profile fields and the session account", async () => {
  const fields = {
    displayName: "New name",
    bio: "New bio",
    avatarUrl: "https://images.example.test/avatar.png",
    expectedUpdatedAt: now.toISOString(),
  };
  const response = await profilePatch(request("PATCH", fields));
  expect(response.status).toBe(200);
  expect(mocks.profile).toHaveBeenCalledWith("usr_author", now, fields, "aud_generated");
  const data = await response.json();
  expect(data.profile).toMatchObject({ displayName: "New name", bio: "New bio" });
  expect(data.profile).not.toHaveProperty("email");
  expect(data.profile).not.toHaveProperty("passwordHash");
  expect((await profilePatch(request("PATCH", { ...fields, role: "admin" }))).status).toBe(422);
});
it("returns a conflict when profile version no longer matches", async () => {
  mocks.profile.mockResolvedValue(null);
  const response = await profilePatch(
    request("PATCH", {
      displayName: "Writer",
      bio: "",
      avatarUrl: "",
      expectedUpdatedAt: now.toISOString(),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "CONFLICT" });
});
it("enforces rates before reading or writing publication data", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await create(request("POST", input))).status).toBe(429);
  expect((await archive(request("DELETE", {}, "ru"), context)).status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("rejects cross-site commands and non-JSON bodies", async () => {
  expect(
    (await create(request("POST", input, "en", { "sec-fetch-site": "cross-site" }))).status,
  ).toBe(403);
  expect(
    (await create(request("POST", input, "en", { "content-type": "text/plain" }))).status,
  ).toBe(415);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("enforces the streamed byte ceiling independently of Content-Length", async () => {
  expect((await create(request("POST", { ...input, body: "a".repeat(140_000) }))).status).toBe(413);
  expect(mocks.create).not.toHaveBeenCalled();
});
