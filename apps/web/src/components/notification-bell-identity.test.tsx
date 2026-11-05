import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  poll: undefined as
    | undefined
    | {
        onValue: (value: unknown) => void;
        onError: () => void;
        read: (signal: AbortSignal) => Promise<unknown>;
      },
  listeners: new Map<string, () => void>(),
  visibility: "visible",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (value: unknown) => {
        h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
  useEffect: (fn: () => undefined | (() => void), deps: unknown[]) => {
    const i = h.cursor++;
    const previous = h.slots[i] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!previous || deps.some((value, j) => value !== previous.deps[j])) {
      previous?.cleanup?.();
      h.slots[i] = { deps, cleanup: fn() };
    }
  },
}));
vi.mock("../lib/visible-polling", () => ({
  startVisiblePolling: (options: typeof h.poll) => {
    h.poll = options;
    return () => {};
  },
}));
vi.mock("../lib/notification-inbox-events", () => ({
  observeNotificationInboxChange: () => () => {},
  announceNotificationInboxChange: () => {},
}));
vi.mock("./use-modal-dialog", () => ({
  useModalDialog: () => ({ current: null }),
  clickedDialogBackdrop: () => false,
}));
vi.mock("./locale-context", async (original) => ({
  ...(await original<typeof import("./locale-context")>()),
  useNexusLocale: () => ({
    locale: "en",
    dictionary: {
      notificationBell: {
        title: "Notifications",
        unreadSuffix: "unread",
        loading: "Loading",
        loadError: "Failed",
        errorHint: "Retry",
        retry: "Retry",
        previewList: "Preview",
        close: "Close",
        empty: "Empty",
        emptyHint: "Empty",
        openCenter: "Open",
        previewFootnote: "Preview",
        view: "View",
      },
      buildReviewNotifications: {},
    },
  }),
}));
import { NotificationBell } from "./notification-bell";
function flatten(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as ReactElement<Record<string, unknown>>;
  return [e, ...flatten(e.props.children as ReactNode)];
}
function render() {
  h.cursor = 0;
  return flatten(NotificationBell());
}
const data = (actorId: string, title: string) => ({
  actorId,
  unreadCount: 1,
  notifications: [
    {
      id: `not_${actorId}`,
      type: "system",
      title,
      message: title,
      link: null,
      category: "system",
      isRead: false,
      createdAt: new Date("2026-10-11T00:00:00.000Z"),
    },
  ],
});
beforeEach(() => {
  h.slots = [];
  h.poll = undefined;
  h.listeners.clear();
  h.visibility = "visible";
  vi.stubGlobal("window", {
    addEventListener: (name: string, fn: () => void) => h.listeners.set(name, fn),
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return h.visibility;
    },
    addEventListener: (name: string, fn: () => void) => h.listeners.set(name, fn),
    removeEventListener: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());
it("conceals A across a hanging or failed B refresh and shows only the confirmed B result", () => {
  render();
  const old = h.poll;
  if (!old) throw Error("Missing poll");
  old.onValue(data("usr_a", "A private"));
  const bell = render().find((n) => n.props["aria-haspopup"] === "dialog");
  if (!bell) throw Error("Missing bell");
  (bell.props.onClick as () => void)();
  expect(render().some((n) => n.type === "article")).toBe(true);
  h.visibility = "hidden";
  h.listeners.get("visibilitychange")?.();
  expect(render().some((n) => n.type === "article")).toBe(false);
  old.onValue(data("usr_a", "Late A"));
  expect(render().some((n) => n.type === "article")).toBe(false);
  h.visibility = "visible";
  h.listeners.get("visibilitychange")?.();
  render();
  expect(render().some((n) => n.type === "article")).toBe(false);
  h.poll?.onError();
  expect(render().some((n) => n.type === "article")).toBe(false);
  h.poll?.onValue(data("usr_b", "B private"));
  expect(render().some((n) => n.type === "article")).toBe(true);
});
it("clears the preview immediately on window blur", () => {
  render();
  h.poll?.onValue(data("usr_a", "A private"));
  h.listeners.get("blur")?.();
  expect(render().find((n) => n.props["aria-haspopup"] === "dialog")?.props["aria-label"]).toBe(
    "Notifications",
  );
});

it("clears a previously confirmed preview before any subsequent refetch", () => {
  render();
  h.poll?.onValue(data("usr_a", "A private"));
  const bell = render().find((n) => n.props["aria-haspopup"] === "dialog");
  if (!bell) throw Error("Missing bell");
  (bell.props.onClick as () => void)();
  expect(render().some((n) => n.type === "article")).toBe(true);
  vi.stubGlobal("fetch", () => new Promise<Response>(() => {}));
  const poll = h.poll;
  if (!poll) throw Error("Missing poll");
  void poll.read(new AbortController().signal);
  expect(render().some((n) => n.type === "article")).toBe(false);
});
