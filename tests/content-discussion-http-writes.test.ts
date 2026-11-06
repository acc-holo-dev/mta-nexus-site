import { AppError } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const { contentDiscussionHttpState } = await import("./helpers/content-discussion-http-harness");
  return {
    ...(await vi.importActual<typeof import("next/server")>("next/server")),
    after: (callback: () => Promise<unknown>) => {
      if (contentDiscussionHttpState.registrationFails) throw Error("runtime-private");
      contentDiscussionHttpState.after.push(callback);
    },
  };
});

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { contentDiscussionHttpState } = await import("./helpers/content-discussion-http-harness");
  return {
    authService: { getSession: async () => contentDiscussionHttpState.actor },
  };
});

vi.mock("../apps/web/src/lib/services/content-service", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return {
    contentService: {
      getArticleBySlug: contentDiscussionHttpMocks.article,
      pageDiscussion: contentDiscussionHttpMocks.page,
      addComment: contentDiscussionHttpMocks.add,
      commentAuthor: contentDiscussionHttpMocks.parent,
    },
  };
});

vi.mock("../apps/web/src/lib/services/discussion-follow-notification-service", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return {
    notifyDiscussionReplies: contentDiscussionHttpMocks.notify,
  };
});

vi.mock("@nexus/security", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return { consumeRateLimit: contentDiscussionHttpMocks.rate };
});

import { POST } from "../apps/web/src/app/api/content/[slug]/comments/route";
import {
  contentDiscussionHttpContext as context,
  contentDiscussionHttpIntent as INTENT,
  contentDiscussionHttpMocks as mocks,
  contentDiscussionHttpRequest as request,
  contentDiscussionHttpState as state,
  installContentDiscussionHttpLifecycle,
} from "./helpers/content-discussion-http-harness";

installContentDiscussionHttpLifecycle();

it("persists a reply with transactional fanout instead of after() dispatch", async () => {
  const response = await POST(
    request("POST", { text: " A useful reply ", parentId: "parent" }),
    context,
  );
  expect(response.status).toBe(201);
  expect(mocks.add).toHaveBeenCalledWith(
    {
      contentId: "content",
      text: "A useful reply",
      parentId: "parent",
      intentKey: INTENT,
    },
    state.actor,
    "test",
  );
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(state.after).toHaveLength(0);
});
it("does not resolve parent authors or schedule after() fanout on write", async () => {
  mocks.article.mockResolvedValue({ id: "content", authorId: "stale-author", slug: "article" });
  await POST(request("POST", { text: "Reply", parentId: "parent" }), context);
  expect(mocks.notify).not.toHaveBeenCalled();
  expect(mocks.parent).not.toHaveBeenCalled();
  expect(state.after).toHaveLength(0);
});
it("keeps a saved reply successful without after() registration", async () => {
  const response = await POST(request("POST", { text: "Saved reply" }), context);
  expect(response.status).toBe(201);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    comment: { id: "comment" },
    replayed: false,
  });
  expect(mocks.add).toHaveBeenCalledOnce();
  expect(state.after).toHaveLength(0);
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("replays the same intent after a lost response without a second create call side effect", async () => {
  mocks.add.mockResolvedValueOnce({
    comment: {
      id: "comment",
      contentId: "content",
      text: "Same intent",
      authorId: "commenter",
    },
    replayed: true,
  });
  const response = await POST(request("POST", { text: "Same intent" }), context);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    comment: { id: "comment", text: "Same intent" },
    replayed: true,
  });
  expect(mocks.add).toHaveBeenCalledWith(
    { contentId: "content", text: "Same intent", intentKey: INTENT },
    state.actor,
    "test",
  );
});
it("rejects payload mismatch on a reused intent key", async () => {
  mocks.add.mockRejectedValueOnce(new AppError("Conflict", 409, "COMMENT_IDEMPOTENCY_CONFLICT"));
  const response = await POST(request("POST", { text: "Changed payload" }), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "COMMENT_IDEMPOTENCY_CONFLICT" });
});
it("requires a canonical UUIDv4 Idempotency-Key", async () => {
  const response = await POST(
    request("POST", { text: "reply" }, "", "en", { "Idempotency-Key": "not-a-uuid" }),
    context,
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "COMMENT_IDEMPOTENCY_KEY_INVALID" });
  expect(mocks.add).not.toHaveBeenCalled();
});
it.each([1, 5001])("rejects comment length %s", async (length) => {
  expect((await POST(request("POST", { text: "x".repeat(length) }), context)).status).toBe(400);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("aligns the 5000-character form and write contract", async () => {
  expect((await POST(request("POST", { text: "x".repeat(5000) }), context)).status).toBe(201);
});
it("keeps writes private and requires authentication, JSON and same-site requests", async () => {
  state.actor = null;
  const anonymous = await POST(request("POST", { text: "reply" }), context);
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
  state.actor = { id: "commenter", username: "writer" };
  expect(
    (
      await POST(
        request("POST", { text: "reply" }, "", "en", { "content-type": "text/plain" }),
        context,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await POST(
        request("POST", { text: "reply" }, "", "en", { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
});
it("localizes revoked publication/parent errors and suppresses side effects", async () => {
  mocks.add.mockRejectedValue(new AppError("Private detail", 400, "COMMENT_PARENT_NOT_FOUND"));
  const response = await POST(
    request("POST", { text: "reply", parentId: "parent" }, "", "ru"),
    context,
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "COMMENT_PARENT_NOT_FOUND" });
  expect(state.after).toHaveLength(0);
});
it("rejects oversized bodies and rate-limited writes", async () => {
  expect((await POST(request("POST", { text: "x".repeat(40000) }), context)).status).toBe(413);
  mocks.rate.mockResolvedValue({ success: false });
  expect((await POST(request("POST", { text: "reply" }), context)).status).toBe(429);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("binds comment creation to the actor displayed on the page", async () => {
  const missing = await POST(
    request("POST", { text: "A useful reply" }, "", "en", { "x-nexus-actor-id": "" }),
    context,
  );
  expect(missing.status).toBe(428);
  const changed = await POST(
    request("POST", { text: "A useful reply" }, "", "en", { "x-nexus-actor-id": "other" }),
    context,
  );
  expect(changed.status).toBe(409);
  expect(mocks.add).not.toHaveBeenCalled();
});
