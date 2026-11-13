import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createDiscussionComposeActorInteractionHelpers,
  mockReactHooks,
} from "../helpers/discussion-compose-actor-interaction-harness";
import { flattenReactTestTree } from "../helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, fetch: vi.fn() }));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { ContentDiscussion } from "../../src/components/content-discussion";

const { render, changeText, submit } = createDiscussionComposeActorInteractionHelpers(
  h,
  ContentDiscussion,
);

it("keeps the original actor-scoped comment and key after loss and a 429 retry", async () => {
  changeText("Original private comment");
  h.fetch.mockRejectedValueOnce(new Error("network lost"));
  await submit();
  const key = "nexus:discussion:compose:v2:user:usr_a:content";
  const saved = sessionStorage.getItem(key);
  expect(saved).toContain("Original private comment");
  expect(render().find((node) => node.type === "textarea")?.props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ code: "RATE_LIMIT_EXCEEDED" }), { status: 429 }),
  );
  await submit();
  const retried = sessionStorage.getItem(key);
  if (!saved || !retried) throw Error("Missing saved intent");
  expect(JSON.parse(retried)).toMatchObject({
    text: JSON.parse(saved).text,
    intentKey: JSON.parse(saved).intentKey,
  });
  const posts = h.fetch.mock.calls.filter(([path]) => path === "/api/content/article/comments");
  expect(posts).toHaveLength(2);
  expect(posts[0]?.[1].body).toBe(posts[1]?.[1].body);
  expect(posts[0]?.[1].headers["Idempotency-Key"]).toBe(posts[1]?.[1].headers["Idempotency-Key"]);
  expect(posts[0]?.[1].headers["x-nexus-actor-id"]).toBe("usr_a");
});

it.each(["en", "ru"] as const)(
  "hides a stale count after a recovered replay in %s",
  async (locale) => {
    const intent = "12345678-1234-4234-8234-123456789abc";
    sessionStorage.setItem(
      "nexus:discussion:compose:v2:user:usr_a:content",
      JSON.stringify({
        version: 1,
        contentId: "content",
        text: "Previously saved comment",
        intentKey: intent,
        savedAt: Date.now(),
      }),
    );
    h.cursor = 0;
    flattenReactTestTree(
      ContentDiscussion({
        slug: "article",
        contentId: "content",
        locale,
        count: 7,
        initial: { items: [], hasMore: false, nextCursor: null },
        viewer: { id: "usr_a", canModerate: false },
      }) as ReactNode,
    );
    h.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comment: {
            id: "cmt_12345678123442348234123456789abc",
            authorId: "usr_a",
            contentId: "content",
            text: "Previously saved comment",
            parentId: null,
          },
          replayed: true,
        }),
        { status: 201 },
      ),
    );
    h.fetch.mockRejectedValueOnce(new Error("read unavailable"));
    await submit();
    const text =
      locale === "ru"
        ? "Общее число комментариев станет доступно после обновления страницы."
        : "Comment total unavailable until refresh.";
    expect(render("usr_a", locale).some((node) => node.props.children === text)).toBe(true);
  },
);
