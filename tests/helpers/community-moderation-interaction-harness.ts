import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type CommunityModerationInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  refresh: Mock;
  fetch: Mock;
  reload: Mock;
};

/** Props match the fixture literals so real ContentModerationControls stays assignable. */
type ContentModerationControlsComponent = (props: {
  contentId: "post";
  expectedUpdatedAt: typeof previous;
  status: "draft";
  workspace?: boolean;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const previous = "2026-10-11T00:00:00.000Z";

export const ack = {
  id: "post",
  action: "publish",
  status: "published",
  updatedAt: "2026-10-11T00:00:01.000Z",
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Shared react mock factory for community-moderation suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: CommunityModerationInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: (effect: () => () => void) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        harness.cleanups.push(effect());
      }
    },
  });
}

export function createCommunityModerationInteractionHelpers(
  harness: CommunityModerationInteractionHarness,
  ContentModerationControls: ContentModerationControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  type Element = FlatTestElement;

  function render(workspace = true) {
    harness.cursor = 0;
    return flattenReactTestTree(
      ContentModerationControls({
        contentId: "post",
        expectedUpdatedAt: previous,
        status: "draft",
        workspace,
      }),
    );
  }

  function button(nodes: Element[], label: string) {
    const node = nodes.find(
      (node) =>
        node.type === "button" &&
        (Array.isArray(node.props.children)
          ? node.props.children.includes(label)
          : node.props.children === label),
    );
    if (!node) throw Error(`Missing button ${label}`);
    return node;
  }

  function click(nodes: Element[], label: string) {
    (button(nodes, label).props.onClick as () => void)();
  }

  function ready(workspace = true) {
    const field = render(workspace).find((node) => node.type === "textarea");
    if (!field) throw Error("Missing reason field");
    (field.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: "Reviewed reason" },
    });
    const nodes = render(workspace);
    expect(button(nodes, "Publish").props.disabled).toBe(false);
    return nodes;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockReset().mockResolvedValue(true);
    harness.fetch.mockResolvedValue(response(ack));
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return { render, button, click, ready };
}
