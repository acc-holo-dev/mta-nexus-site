import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { followCopy } from "../../src/lib/follow-workspace-copy";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ContentFollowControlsInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
};

type Element = FlatTestElement;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

/** Props match the fixture literals so real ContentFollowControls stays assignable. */
type ContentFollowControlsComponent = (props: {
  contentId: "article";
  title: "Article";
  initial: typeof initial;
  locale: "ru" | "en";
}) => ReactElement<{ children?: ReactNode }>;

const initial = {
  authenticated: true,
  actorId: "usr_1",
  following: true,
  notifyComments: false,
  muted: false,
  mutedUntil: null,
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for content-follow-controls suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ContentFollowControlsInteractionHarness) {
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

export function createContentFollowControlsInteractionHelpers(
  harness: ContentFollowControlsInteractionHarness,
  ContentFollowControls: ContentFollowControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(locale: "ru" | "en" = "en") {
    harness.cursor = 0;
    const wrapper = ContentFollowControls({
      contentId: "article",
      title: "Article",
      initial,
      locale,
    });
    const control = wrapper.props.children as ReactElement;
    return flattenReactTestTree((control.type as (props: unknown) => ReactNode)(control.props));
  }

  function saveToggle(nodes: Element[], locale: "ru" | "en" = "en") {
    const copy = followCopy(locale);
    const labels = new Set([`${copy.removeSave}: Article`, `${copy.savePublication}: Article`]);
    const element = nodes.find(
      (node) =>
        node.type === "button" &&
        typeof node.props["aria-label"] === "string" &&
        labels.has(node.props["aria-label"] as string),
    );
    if (!element) throw Error("Missing content follow save control");
    return element;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return { render, saveToggle };
}
