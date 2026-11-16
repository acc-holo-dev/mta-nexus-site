import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { DiscussionPage } from "../../src/lib/content-discussion-contract";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type DiscussionCommentActionsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
  onPending: Mock;
  onSaved: Mock;
};

/** Props match the fixture literals so real DiscussionCommentActions stays assignable. */
type DiscussionCommentActionsComponent = (props: {
  comment: typeof comment;
  own: boolean;
  slug: typeof slug;
  contentId: typeof contentId;
  locale: "en" | "ru";
  disabled: boolean;
  onPending: Mock;
  onSaved: Mock;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const revision = "a".repeat(64);
export const comment: DiscussionPage["items"][number] = {
  id: "cmt_aaaaaaaaaaaaaaaaaaaaaaaa",
  revision,
  text: "Please clarify the install steps.",
  parentId: null,
  createdAt: "2026-10-11T00:00:00.000Z",
  author: {
    id: "usr_author",
    username: "author",
    displayName: "Author",
    avatarUrl: null,
  },
  parent: null,
};
export const contentId = "cnt_aaaaaaaaaaaaaaaaaaaaaaaa";
export const slug = "guide";

/** Shared react mock factory for discussion-comment-actions confirm suites. */
export function mockReactHooks(harness: DiscussionCommentActionsConfirmHarness) {
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
    useEffect: () => {
      // Abort cleanup is out of scope for confirm coverage.
    },
  });
}

function seedIdleSlots(harness: DiscussionCommentActionsConfirmHarness) {
  // mode, text, revision, reason, error, pending, draftNotice, busy, alive, controller, blocked
  harness.slots = [
    null,
    comment.text,
    comment.revision,
    "",
    "",
    false,
    "",
    { current: false },
    { current: true },
    { current: null },
    false,
  ];
}

export function createDiscussionCommentActionsConfirmInteractionHelpers(
  harness: DiscussionCommentActionsConfirmHarness,
  DiscussionCommentActions: DiscussionCommentActionsComponent,
  confirmAction: ConfirmActionMock,
) {
  function seedIdle() {
    seedIdleSlots(harness);
  }

  function seedModeratorRemove() {
    harness.slots = [
      "remove",
      comment.text,
      comment.revision,
      "Spam and off-topic",
      "",
      false,
      "",
      { current: false },
      { current: true },
      { current: null },
      false,
    ];
  }

  function render(own: boolean, locale: "en" | "ru" = "en") {
    harness.cursor = 0;
    return flattenReactTestTree(
      DiscussionCommentActions({
        comment,
        own,
        slug,
        contentId,
        locale,
        disabled: false,
        onPending: harness.onPending,
        onSaved: harness.onSaved,
      }),
    );
  }

  function control(nodes: Element[], label: string) {
    return findTestButton(nodes, label);
  }

  function submit(nodes: Element[]) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing moderation remove form");
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault() {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedIdle();
    confirmAction.mockResolvedValue(true);
    harness.request.mockReset();
    harness.onPending.mockReset();
    harness.onSaved.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    control,
    submit,
    seedIdle,
    seedModeratorRemove,
  };
}
