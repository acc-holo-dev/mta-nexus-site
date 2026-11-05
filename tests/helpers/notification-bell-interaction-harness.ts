import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

type NotificationBellHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  announce: Mock;
  observe: Mock;
};

type Element = ReactElement<Record<string, unknown>>;

type NotificationBellComponent = () => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const sample = {
  actorId: "usr_1",
  notifications: [
    {
      id: "not_1",
      recipientId: "user",
      type: "system",
      title: "Hello",
      message: "World",
      link: "/articles/topic",
      category: "system",
      isRead: false,
      createdAt: new Date("2026-10-11T00:00:00.000Z"),
    },
  ],
  unreadCount: 3,
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Shared locale dictionary for notification-bell interaction suites. */
export const notificationBellDictionary = {
  notificationBell: {
    close: "Close notifications",
    title: "Notifications",
    unreadSuffix: "unread notifications",
    markAllRead: "Mark all read",
    markedAllRead: "All notifications marked as read.",
    view: "View",
    loading: "Loading notifications...",
    empty: "No notifications yet",
    emptyHint: "New notifications appear in this preview when activity reaches your account.",
    openCenter: "Open notification center",
    previewFootnote:
      "Preview shows up to 6 recent items. The unread count covers your entire inbox.",
    loadError: "Could not load notifications.",
    markError: "Could not mark notifications as read.",
    retry: "Retry",
    errorHint: "Retry refreshes this preview only. It does not mark notifications as read.",
  },
  buildReviewNotifications: {
    approved: "Resource version approved",
    rejected: "Resource version rejected",
    version: "Version",
    notes: "Moderator comment",
  },
};

/** Shared react mock factory for bell interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: NotificationBellHarness) {
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
        if (typeof cleanup === "function") harness.cleanups.push(cleanup);
      }
    },
  });
}

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as
    | { displayName?: string; name?: string }
    | (((props: unknown) => ReactNode) & { displayName?: string; name?: string })
    | string;
  if (typeof type === "function") {
    const name = type.displayName || type.name;
    if (name === "ErrorState" || name === "EmptyState") {
      return descendants(type(element.props));
    }
    if (name === "Button") {
      return [
        { ...element, type: "button" } as Element,
        ...descendants(element.props.children as ReactNode),
      ];
    }
  } else if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

export function textOf(node: Element): string {
  const children = node.props.children;
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children))
    return children
      .map((child) =>
        typeof child === "object" && child ? textOf(child as Element) : String(child ?? ""),
      )
      .join("");
  if (children && typeof children === "object" && "props" in children)
    return textOf(children as Element);
  return "";
}

export function createNotificationBellInteractionHelpers(
  harness: NotificationBellHarness,
  NotificationBell: NotificationBellComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return descendants(NotificationBell());
  }

  function bellButton(nodes = render()) {
    const found = nodes.find(
      (node) => node.type === "button" && node.props["aria-haspopup"] === "dialog",
    );
    if (!found) throw Error("Missing bell");
    return found;
  }

  function openPopover() {
    (bellButton().props.onClick as () => void)();
    return render();
  }

  function markAllButton(nodes = render()) {
    const found = nodes.find(
      (node) => node.type === "button" && textOf(node).includes("Mark entire inbox as read"),
    );
    if (!found) throw Error("Missing mark all");
    return found;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    harness.fetch.mockReset();
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener() {},
      removeEventListener() {},
    });
    vi.stubGlobal("window", {
      addEventListener() {},
      removeEventListener() {},
      setInterval,
      clearInterval,
      setTimeout,
      clearTimeout,
    });
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
  });

  return {
    render,
    bellButton,
    openPopover,
    markAllButton,
  };
}
