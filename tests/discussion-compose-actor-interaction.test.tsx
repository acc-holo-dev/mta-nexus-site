import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const h = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, fetch: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      h.slots[i],
      (value: unknown) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect: () => {
    h.cursor++;
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));
vi.mock("next/link", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import { ContentDiscussion } from "../apps/web/src/components/content-discussion";

function render(actorId: string | null = "usr_a", locale: "en" | "ru" = "en") {
  h.cursor = 0;
  return flattenReactTestTree(
    ContentDiscussion({
      slug: "article",
      contentId: "content",
      locale,
      count: 0,
      initial: { items: [], hasMore: false, nextCursor: null },
      viewer: actorId ? { id: actorId, canModerate: false } : null,
    }) as ReactNode,
  );
}
function changeText(value: string, actorId: string | null = "usr_a") {
  const field = render(actorId).find((node) => node.type === "textarea");
  if (!field) throw Error("Missing comment field");
  (field.props.onChange as (event: unknown) => void)({ target: { value } });
}
async function submit(actorId: string | null = "usr_a") {
  const form = render(actorId).find(
    (node) => node.type === "form" && node.props["aria-busy"] !== undefined,
  );
  if (!form) throw Error("Missing comment form");
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.fetch.mockReset();
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
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
it("retains a guest draft for explicit publication after sign-in, without a guest request", async () => {
  changeText("Guest draft text", null);
  await submit(null);
  expect(h.fetch).not.toHaveBeenCalled();
  h.slots = [];
  const field = render("usr_a").find((node) => node.type === "textarea");
  expect(field?.props.value).toBe("Guest draft text");
  expect(sessionStorage.getItem("nexus:discussion:compose:v2:guest:content")).toBeNull();
  expect(sessionStorage.getItem("nexus:discussion:compose:v2:user:usr_a:content")).toContain(
    "Guest draft text",
  );
});
it("does not send a comment if pending recovery data cannot be stored", async () => {
  changeText("Original private comment");
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  });
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
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
