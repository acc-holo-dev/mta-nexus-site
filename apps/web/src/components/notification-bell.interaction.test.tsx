import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
  observe: vi.fn(() => () => {}),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
  useEffect: (effect: () => void | (() => void)) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      const cleanup = effect();
      if (typeof cleanup === "function") harness.cleanups.push(cleanup);
    }
  },
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en",
    dictionary: {
      notificationBell: {
        close: "Close notifications",
        title: "Notifications",
        unreadSuffix: "unread notifications",
        markAllRead: "Mark all read",
        markedAllRead: "All notifications marked as read.",
        view: "View",
        loading: "Loading notifications...",
        empty: "No notifications yet",
        openCenter: "Open notification center",
        loadError: "Could not load notifications.",
        markError: "Could not mark notifications as read.",
        retry: "Retry",
      },
      buildReviewNotifications: {
        approved: "Resource version approved",
        rejected: "Resource version rejected",
        version: "Version",
        notes: "Moderator comment",
      },
    },
  }),
}));
vi.mock("../lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
  observeNotificationInboxChange: harness.observe,
}));
vi.mock("./use-modal-dialog", () => ({
  useModalDialog: () => ({ current: null }),
  clickedDialogBackdrop: () => false,
}));

import { NotificationBell } from "./notification-bell";

type Element = ReactElement<Record<string, unknown>>;
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
function textOf(node: Element): string {
  const children = node.props.children;
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children))
    return children.map((child) => (typeof child === "object" && child ? textOf(child as Element) : String(child ?? ""))).join("");
  if (children && typeof children === "object" && "props" in children)
    return textOf(children as Element);
  return "";
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const sample = {
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

beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  harness.cleanups = [];
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal("window", {
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

it("shows loading instead of empty until the first successful inbox preview", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  openPopover();
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(true);
  expect(render().some((node) => textOf(node).includes("No notifications yet"))).toBe(false);
  expect(bellButton().props["aria-label"]).toBe("Notifications");
  complete(response({ notifications: [], unreadCount: 0 }));
  await vi.waitFor(() =>
    expect(render().some((node) => textOf(node).includes("No notifications yet"))).toBe(true),
  );
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(false);
});

it("keeps a first-load failure distinct from empty and does not confirm a zero badge", async () => {
  harness.fetch.mockResolvedValueOnce(response({ error: "boom" }, 500));
  openPopover();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(render().some((node) => textOf(node).includes("No notifications yet"))).toBe(false);
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(true);
  expect(bellButton().props["aria-label"]).toBe("Notifications");
  expect(
    render().some(
      (node) =>
        typeof node.props.className === "string" &&
        node.props.className.includes("bg-accent") &&
        textOf(node) === "0",
    ),
  ).toBe(false);
});

it("does not treat opening the popover as mark-all-read", async () => {
  harness.fetch.mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() =>
    expect(render().some((node) => textOf(node).includes("Hello"))).toBe(true),
  );
  expect(harness.fetch.mock.calls.every(([url]) => url === "/api/notifications?limit=6")).toBe(
    true,
  );
  expect(
    harness.fetch.mock.calls.some(([url]) => String(url).includes("/api/notifications/mark-read")),
  ).toBe(false);
});

it("preserves confirmed unread counts when account-wide mark-all fails", async () => {
  harness.fetch
    .mockResolvedValueOnce(response(sample))
    .mockResolvedValueOnce(response({ error: "failed" }, 500))
    .mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() =>
    expect(bellButton().props["aria-label"]).toBe("3 unread notifications"),
  );
  const mark = render().find(
    (node) => node.type === "button" && textOf(node).includes("Mark all read"),
  );
  if (!mark) throw Error("Missing mark all");
  await (mark.props.onClick as () => Promise<void>)();
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.role === "alert")).toBe(true),
  );
  expect(bellButton().props["aria-label"]).toBe("3 unread notifications");
  expect(harness.fetch.mock.calls.some(([url]) => url === "/api/notifications/mark-read")).toBe(
    true,
  );
});

it("keeps destination links from marking notifications read", async () => {
  harness.fetch.mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() =>
    expect(render().some((node) => node.type === "a" && node.props.href === "/articles/topic")).toBe(
      true,
    ),
  );
  const link = render().find((node) => node.type === "a" && node.props.href === "/articles/topic");
  (link?.props.onClick as () => void)();
  expect(
    harness.fetch.mock.calls.some(
      ([url, init]) =>
        String(url).includes("mark-read") ||
        (String(url).includes("/inbox") && init?.method === "PATCH"),
    ),
  ).toBe(false);
});
