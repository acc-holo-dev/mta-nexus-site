import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type DiscussionComposeActorInteractionHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
};

/** Props match ContentDiscussion fixtures so the real component stays assignable. */
type ContentDiscussionComponent = (props: {
  slug: string;
  contentId: string;
  locale: "en" | "ru";
  count: number;
  initial: { items: []; hasMore: false; nextCursor: null };
  viewer: { id: string; canModerate: false } | null;
}) => ReactNode;

/** Shared react mock factory for discussion-compose-actor suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: DiscussionComposeActorInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots))
        harness.slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        harness.slots[i],
        (value: unknown) => {
          harness.slots[i] = typeof value === "function" ? value(harness.slots[i]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
    useEffect: () => {
      harness.cursor++;
    },
  });
}

export function createDiscussionComposeActorInteractionHelpers(
  harness: DiscussionComposeActorInteractionHarness,
  ContentDiscussion: ContentDiscussionComponent,
) {
  function render(actorId: string | null = "usr_a", locale: "en" | "ru" = "en") {
    harness.cursor = 0;
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
    harness.slots = [];
    harness.cursor = 0;
    harness.fetch.mockReset();
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, changeText, submit };
}
