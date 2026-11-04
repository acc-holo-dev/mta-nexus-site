import { afterEach, beforeEach, expect, vi, type Mock } from "vitest";
import {
  clickTestButton,
  findTestButton,
  flattenReactTestTree,
  type FlattenedElement,
} from "./flatten-react-test-tree";

export type NotificationInboxHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  announce: Mock;
};

export type NotificationInboxComponent = (props: {
  initialPage: typeof initialPage;
  filters: typeof filters | { query: string; state: string; category: string };
}) => unknown;

export const filters = {
  query: "topic",
  state: "unread" as const,
  category: "content" as const,
};

export const initialPage = {
  items: [
    {
      id: "owned",
      title: "Topic",
      message: "Message",
      link: "/articles/topic",
      category: "content" as const,
      isRead: false,
      createdAt: "2026-10-11T00:00:00.123456Z",
      truncated: false,
    },
  ],
  unreadCount: 2,
  olderCursor: null,
  newerCursor: null,
};

export const refreshed = {
  items: [],
  unreadCount: 1,
  olderCursor: null,
  newerCursor: null,
};

export const exportReport = {
  version: 1,
  scope: "notification-inbox-page",
  locale: "en",
  filters: { ...filters, period: "all" },
  window: null,
  items: initialPage.items.map(({ link: _link, ...item }) => item),
  hasOlder: false,
  hasNewer: false,
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export function exportResponse(value: unknown = exportReport) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="nexus-notification-page.json"',
    },
  });
}

export function browserDownload() {
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  const createObjectURL = vi.fn().mockReturnValue("blob:nexus-test"),
    revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const appendChild = vi.fn();
  vi.stubGlobal("document", {
    createElement: () => link,
    body: { appendChild },
  });
  return { link, createObjectURL, revokeObjectURL, appendChild };
}

/** Shared react mock factory for inbox interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: NotificationInboxHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
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

export function createNotificationInboxInteractionHelpers(
  harness: NotificationInboxHarness,
  NotificationInbox: NotificationInboxComponent,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(NotificationInbox({ initialPage, filters })) as FlattenedElement[];
  }

  function selectionConfirmCheckbox(nodes = render()) {
    const found = nodes.find(
      (node) =>
        node.type === "input" &&
        node.props.type === "checkbox" &&
        node.props.id === "notification-inbox-selection-confirm",
    );
    if (!found) throw Error("Missing selection confirmation");
    return found;
  }

  function acknowledgeSelection(nodes = render()) {
    (selectionConfirmCheckbox(nodes).props.onChange as (event: unknown) => void)({
      target: { checked: true },
    });
  }

  function exportLink(nodes = render()) {
    const found = nodes.find(
      (node) => node.type === "a" && node.props.download === "nexus-notification-page.json",
    );
    if (!found) throw Error("Missing export");
    return found;
  }

  function exportClick(nodes = render()) {
    const preventDefault = vi.fn();
    (exportLink(nodes).props.onClick as (event: unknown) => void)({
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    vi.stubGlobal("fetch", harness.fetch);
    harness.fetch
      .mockReset()
      .mockResolvedValueOnce(response({ isRead: true, ids: ["owned"] }))
      .mockResolvedValueOnce(response(refreshed));
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return {
    render,
    button: findTestButton,
    click: clickTestButton,
    selectionConfirmCheckbox,
    acknowledgeSelection,
    exportLink,
    exportClick,
  };
}
