import { AppError } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { userPlatformHttpState } = await import("./helpers/user-platform-http-harness");
  return {
    authService: { getSession: async () => userPlatformHttpState.user },
  };
});

vi.mock("@nexus/db", async () => {
  const { userPlatformHttpMocks } = await import("./helpers/user-platform-http-harness");
  return {
    authorContentRepository: {
      findAuthored: userPlatformHttpMocks.find,
      mutate: userPlatformHttpMocks.mutate,
      pageByAuthor: userPlatformHttpMocks.page,
    },
    contentRepository: { createWithAudit: userPlatformHttpMocks.create },
    userRepository: { updatePublicProfile: userPlatformHttpMocks.profile },
  };
});

vi.mock("@nexus/security", async () => {
  const { userPlatformHttpMocks } = await import("./helpers/user-platform-http-harness");
  return {
    consumeRateLimit: userPlatformHttpMocks.rate,
    generateId: (prefix: string) => `${prefix}_generated`,
  };
});

import {
  DELETE as archive,
  GET as get,
  PATCH as update,
} from "../apps/web/src/app/api/workspace/content/[id]/route";
import { POST as create, GET as list } from "../apps/web/src/app/api/workspace/content/route";
import {
  installUserPlatformHttpLifecycle,
  userPlatformHttpContentContext as context,
  userPlatformHttpContentInput as input,
  userPlatformHttpMocks as mocks,
  userPlatformHttpNow as now,
  userPlatformHttpRequest as request,
  userPlatformHttpState as state,
} from "./helpers/user-platform-http-harness";

installUserPlatformHttpLifecycle();

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
