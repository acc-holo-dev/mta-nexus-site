import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type DiscussionWatchInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
};

type Element = FlatTestElement;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

/** Props match the fixture literals so real FollowButton stays assignable. */
type FollowButtonComponent = (props: {
  targetType: "content";
  targetId: "article";
  targetName: "Article";
  initial: typeof initial;
  locale: "ru" | "en";
}) => ReactElement<{ children?: ReactNode }>;

export const initial = { authenticated: true, actorId: "usr_1", following: false };

export const ack = {
  success: true,
  following: true,
  targetType: "content",
  targetId: "article",
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for discussion-watch suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: DiscussionWatchInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (value: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = value;
      return [
        harness.slots[index],
        (next: unknown) => {
          harness.slots[index] =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(harness.slots[index])
              : next;
        },
      ];
    },
    useRef: (value: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: value };
      return harness.slots[index];
    },
    useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
      const index = harness.cursor++;
      const old = harness.slots[index] as unknown[] | undefined;
      if (!old || old.length !== deps.length || deps.some((value, i) => value !== old[i])) {
        harness.slots[index] = deps;
        const cleanup = effect();
        if (cleanup) harness.cleanups.push(cleanup);
      }
    },
  });
}

export function createDiscussionWatchInteractionHelpers(
  harness: DiscussionWatchInteractionHarness,
  FollowButton: FollowButtonComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(locale: "ru" | "en" = "en") {
    harness.cursor = 0;
    const wrapper = FollowButton({
      targetType: "content",
      targetId: "article",
      targetName: "Article",
      initial,
      locale,
    });
    const control = wrapper.props.children as ReactElement;
    return flattenReactTestTree((control.type as (props: unknown) => ReactNode)(control.props));
  }

  function toggle(nodes: Element[]) {
    const element = nodes.find((node) => node.type === "button" && node.props["aria-label"]);
    if (!element) throw Error("Missing follow control");
    return element;
  }

  function runCleanups() {
    for (const cleanup of harness.cleanups) cleanup();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    initial.following = false;
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    runCleanups();
    vi.unstubAllGlobals();
  });

  return { render, toggle, runCleanups };
}
