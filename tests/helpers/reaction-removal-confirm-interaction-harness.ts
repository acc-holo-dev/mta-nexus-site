import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { reactionCopy } from "../../site/src/lib/content-reaction-copy";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type ReactionRemovalConfirmHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: Array<undefined | (() => void)>;
  fetch: Mock;
  actorId: string;
};

/** Props match the fixture literals so real ReactionRemoval stays assignable. */
type ReactionRemovalComponent = (props: {
  contentId: typeof contentId;
  actorId: string;
  reloadHref: "/workspace/reactions";
  locale: "en";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const contentId = "content_aaaaaaaaaaaaaaaaaaaaaa";

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for reaction-removal confirm suites. */
export function mockReactHooks(harness: ReactionRemovalConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
      const index = harness.cursor++;
      const previous = harness.slots[index] as unknown[] | undefined;
      if (
        !previous ||
        previous.length !== deps.length ||
        deps.some((value, i) => value !== previous[i])
      ) {
        harness.slots[index] = deps;
        const cleanup = effect();
        if (cleanup) harness.cleanups.push(cleanup);
      }
    },
  });
}

function componentName(type: Element["type"]): string | undefined {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name;
  }
  if (typeof type === "object" && type !== null) {
    return (type as { displayName?: string }).displayName;
  }
  return undefined;
}

export function findNamed(nodes: Element[], name: string) {
  const found = nodes.find((node) => componentName(node.type) === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

export function createReactionRemovalConfirmInteractionHelpers(
  harness: ReactionRemovalConfirmHarness,
  ReactionRemoval: ReactionRemovalComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ReactionRemoval({
        contentId,
        actorId: harness.actorId,
        reloadHref: "/workspace/reactions",
        locale: "en",
      }),
    );
  }

  function removeButton(nodes: Element[]) {
    return findTestButton(nodes, reactionCopy("en").remove);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.actorId = "actor";
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup?.();
    vi.unstubAllGlobals();
  });

  return { render, removeButton };
}
