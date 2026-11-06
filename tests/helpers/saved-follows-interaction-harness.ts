import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { FollowPage } from "../../apps/web/src/lib/follow-workspace-contract";
import { followCopy } from "../../apps/web/src/lib/follow-workspace-copy";

type SavedFollowsHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
};

type FollowWorkspaceComponent = (props: {
  actorId: string;
  initial: FollowPage | null;
  query: string;
  locale: "en" | "ru";
}) => ReactElement<{ children?: ReactNode }>;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = ReactElement<Record<string, unknown>>;

const initialPage: FollowPage = {
  items: [
    {
      id: "f",
      targetType: "organization",
      targetId: "org",
      notifyComments: false,
      createdAt: "2026-10-10T12:00:00.000Z",
      title: "Team",
      description: "Public organization",
      image: null,
      verified: true,
      href: "/organizations/team",
      mutedUntil: null,
    },
  ],
  hasMore: false,
  nextCursor: null,
};

export const ack = {
  success: true,
  following: false,
  targetType: "organization",
  targetId: "org",
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for saved-follows suites. */
export function mockReactHooks(harness: SavedFollowsHarness) {
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
    useEffect: (effect: () => undefined | (() => void)) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        const cleanup = effect();
        if (cleanup) harness.cleanups.push(cleanup);
      }
    },
  });
}

export function createSavedFollowsInteractionHelpers(
  harness: SavedFollowsHarness,
  FollowWorkspace: FollowWorkspaceComponent,
  confirmAction: ConfirmActionMock,
) {
  function descendants(node: ReactNode): Element[] {
    if (Array.isArray(node)) return node.flatMap(descendants);
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    const type = element.type as { displayName?: string } | string;
    if (typeof type === "object" && type?.displayName === "Button") {
      return [
        { ...element, type: "button" } as Element,
        ...descendants(element.props.children as ReactNode),
      ];
    }
    return [element, ...descendants(element.props.children as ReactNode)];
  }

  function render(locale: "en" | "ru" = "en") {
    harness.cursor = 0;
    return descendants(
      FollowWorkspace({ actorId: "usr_1", initial: initialPage, query: "", locale }),
    );
  }

  function removeButton(nodes: Element[], locale: "en" | "ru") {
    const label = `${followCopy(locale).remove}: Team`;
    const found = nodes.find(
      (node) => node.type === "button" && node.props["aria-label"] === label,
    );
    if (!found) throw Error(`Missing remove control for ${locale}`);
    return found;
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

  return { render, removeButton, descendants };
}
