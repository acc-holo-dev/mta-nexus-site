import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  discussion: vi.fn(),
  discussionDetail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND_BOUNDARY");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: state,
}));
vi.mock("../apps/web/src/components/moderated-discussion-removal", () => ({
  ModeratedDiscussionRemoval: () => <div data-removal="available" />,
}));

import { ModeratedDiscussionScreen } from "../apps/web/src/components/moderated-discussion-screen";

const time = "2026-10-11T00:00:00.000Z",
  publication = {
    id: "post",
    title: "Private publication",
    slug: "guide",
    type: "post",
    status: "archived",
  };
const page = {
  publication,
  items: [
    {
      id: "comment",
      text: "<script>unsafe</script>",
      createdAt: time,
      author: { username: "writer", name: "Writer" },
    },
  ],
  hasMore: true,
  nextCursor: "continuation",
};
const detail = {
  publication,
  comment: {
    id: "comment",
    text: "Reviewed text",
    truncated: false,
    revision: "a".repeat(64),
    createdAt: time,
    author: null,
    parent: "Context <script>",
  },
  history: [
    {
      id: "event",
      action: "content.comment_edited",
      moderator: false,
      reason: null,
      createdAt: time,
    },
  ],
  hasMore: false,
  nextCursor: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "staff", role: "moderator" });
  state.discussion.mockResolvedValue(page);
  state.discussionDetail.mockResolvedValue(detail);
});
it.each(["en", "ru"] as const)(
  "renders localized moderation navigation, escaped text and scoped pagination in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await ModeratedDiscussionScreen({
        id: "post",
        searchParams: Promise.resolve({ q: "word", author: "writer" }),
      }),
    );
    expect(html).toContain(locale === "ru" ? "Модерация обсуждения" : "Discussion moderation");
    expect(html).toContain("&lt;script&gt;unsafe&lt;/script&gt;");
    expect(html).toContain("/admin/community/post/discussion/comment");
    expect(html).toContain("q=word&amp;author=writer&amp;cursor=continuation");
    expect(html).not.toContain("/articles/guide");
    expect(html).not.toMatch(/data-removal/u);
  },
);
it("renders removed state and retained reason without an active delete control or deleted text", async () => {
  state.discussionDetail.mockResolvedValue({
    ...detail,
    comment: null,
    history: [
      {
        id: "removal",
        action: "content.comment_removed",
        moderator: true,
        reason: "Retained reason",
        createdAt: time,
      },
    ],
  });
  const html = renderToStaticMarkup(
    await ModeratedDiscussionScreen({ id: "post", commentId: "comment" }),
  );
  expect(html).toContain("This comment has been removed");
  expect(html).toContain("Retained reason");
  expect(html).not.toContain("data-removal");
  expect(html).not.toContain("Reviewed text");
});
it("renders parent context and removal control only for an existing scoped comment", async () => {
  const html = renderToStaticMarkup(
    await ModeratedDiscussionScreen({ id: "post", commentId: "comment" }),
  );
  expect(html).toContain("Context &lt;script&gt;");
  expect(html).toContain('data-removal="available"');
  expect(html).toContain("Author action");
});
it("denies ordinary sessions before loading private discussion and shows login for anonymous visitors", async () => {
  state.session.mockResolvedValue({ id: "actor", role: "user" });
  expect(renderToStaticMarkup(await ModeratedDiscussionScreen({ id: "post" }))).toContain(
    "current administrator or moderator",
  );
  expect(state.discussion).not.toHaveBeenCalled();
  state.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await ModeratedDiscussionScreen({ id: "post" }))).toContain(
    "/auth/login",
  );
});
it("shows localized service failures and rejects scope-mismatched DTOs", async () => {
  state.discussion.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  expect(renderToStaticMarkup(await ModeratedDiscussionScreen({ id: "post" }))).toContain(
    'role="alert"',
  );
  state.discussion.mockResolvedValue({ ...page, publication: { ...publication, id: "foreign" } });
  const html = renderToStaticMarkup(await ModeratedDiscussionScreen({ id: "post" }));
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Private publication");
});
