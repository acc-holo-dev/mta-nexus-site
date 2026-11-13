import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { moderatedDiscussionCopy } from "../../site/src/lib/moderated-discussion-copy";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type ModeratedDiscussionRemovalConfirmHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: Array<undefined | (() => void)>;
  fetch: Mock;
  refresh: Mock;
};

/** Props match the fixture literals so real ModeratedDiscussionRemoval stays assignable. */
type ModeratedDiscussionRemovalComponent = (props: {
  contentId: typeof contentId;
  commentId: typeof commentId;
  revision: typeof revision;
  locale: "en";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const contentId = "post";
export const commentId = "comment";
const revision = "a".repeat(64);
export const reason = "Reviewed reason";

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for moderated-discussion-removal confirm suites. */
export function mockReactHooks(harness: ModeratedDiscussionRemovalConfirmHarness) {
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

export function createModeratedDiscussionRemovalConfirmInteractionHelpers(
  harness: ModeratedDiscussionRemovalConfirmHarness,
  ModeratedDiscussionRemoval: ModeratedDiscussionRemovalComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ModeratedDiscussionRemoval({
        contentId,
        commentId,
        revision,
        locale: "en",
      }),
    );
  }

  function removeButton(nodes: Element[]) {
    return findTestButton(nodes, moderatedDiscussionCopy("en").remove);
  }

  function prepareReason() {
    const field = render().find((node) => node.type === "textarea");
    if (!field) throw new Error("Missing reason");
    (field.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: reason },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup?.();
    vi.unstubAllGlobals();
  });

  return { render, removeButton, prepareReason };
}
