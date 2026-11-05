import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { reactionCopy } from "../../apps/web/src/lib/content-reaction-copy";

type ContentReactionRemoveInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  actorId: string;
};

/** Props match the fixture literals so real ContentReactions stays assignable. */
type ReactionInitial = {
  contentId: "content";
  slug: "guide";
  authenticated: true;
  actorId: string;
  self: false;
  reaction: "thanks";
  counts: { helpful: 2; thanks: 3; insight: 0 };
};

type ContentReactionsComponent = (props: {
  slug: "guide";
  contentId: "content";
  initial: ReactionInitial;
  locale: "en";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = ReactElement<Record<string, unknown>>;

const saved = {
  contentId: "content",
  slug: "guide",
  authenticated: true,
  actorId: "actor",
  self: false,
  reaction: "thanks",
  counts: { helpful: 2, thanks: 3, insight: 0 },
} as const satisfies Omit<ReactionInitial, "actorId"> & { actorId: "actor" };

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for content-reaction-remove suites. */
export function mockReactHooks(harness: ContentReactionRemoveInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (value: unknown) => {
          harness.slots[i] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[i])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
    useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
      const i = harness.cursor++;
      const old = harness.slots[i] as unknown[] | undefined;
      if (!old || old.length !== deps.length || deps.some((value, index) => value !== old[index])) {
        harness.slots[i] = deps;
        const cleanup = effect();
        if (cleanup) harness.cleanups.push(cleanup);
      }
    },
  });
}

export function createContentReactionRemoveInteractionHelpers(
  harness: ContentReactionRemoveInteractionHarness,
  ContentReactions: ContentReactionsComponent,
  confirmAction: ConfirmActionMock,
) {
  function buttons(node: ReactNode): Element[] {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    const type = element.type as { displayName?: string } | string;
    if (typeof type === "object" && type?.displayName === "Button") {
      return [{ ...element, type: "button" } as Element];
    }
    return buttons(element.props.children as ReactNode);
  }

  function render() {
    harness.cursor = 0;
    return buttons(
      ContentReactions({
        slug: "guide",
        contentId: "content",
        initial: { ...saved, actorId: harness.actorId } satisfies ReactionInitial,
        locale: "en",
      }),
    );
  }

  function removeButton(nodes: Element[]) {
    const button = nodes.find((node) => node.props.children === reactionCopy("en").remove);
    if (!button) throw new Error("missing remove control");
    return button;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    harness.actorId = "actor";
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return { render, removeButton };
}
