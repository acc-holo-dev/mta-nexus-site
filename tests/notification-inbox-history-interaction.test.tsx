import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clickTestButton,
  findTestButton,
  flattenReactTestTree,
} from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
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
  useEffect: (effect: () => () => void) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = true;
      harness.cleanups.push(effect());
    }
  },
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../apps/web/src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../apps/web/src/components/notification-inbox";

const filters = {
  query: "topic",
  state: "unread" as const,
  category: "content" as const,
};
const initialPage = {
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
const refreshed = {
  items: [],
  unreadCount: 1,
  olderCursor: null,
  newerCursor: null,
};
function render() {
  harness.cursor = 0;
  return flattenReactTestTree(NotificationInbox({ initialPage, filters }));
}
const button = findTestButton;
const click = clickTestButton;
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
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
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
it("keeps download read-only and makes it unavailable during an uncertain update until saved-state reload", async () => {
  const download = () =>
    render().find(
      (node) => node.type === "a" && node.props.download === "nexus-notification-page.json",
    );
  expect(download()?.props.href).toBe(
    "/api/notifications/inbox/export?q=topic&state=unread&category=content",
  );
  expect(harness.fetch).not.toHaveBeenCalled();
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ code: "NOTIFICATION_STATE_CHANGED" }, 409))
    .mockResolvedValueOnce(response(initialPage));
  click(render(), "Mark as read");
  expect(download()).toBeUndefined();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(download()).toBeUndefined();
  click(render(), "Reload saved inbox");
  await vi.waitFor(() => expect(download()).toBeDefined());
  expect(harness.announce).not.toHaveBeenCalled();
});
it("saves a single observed notification then reads the filtered inbox before showing success", async () => {
  click(render(), "Mark as read");
  await vi.waitFor(() =>
    expect(
      render().some(
        (node) =>
          node.props.role === "status" &&
          node.props.children === "Reading status saved and the inbox refreshed.",
      ),
    ).toBe(true),
  );
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/notifications/inbox");
  expect(JSON.parse(init.body)).toEqual({
    isRead: true,
    items: [{ id: "owned", expectedIsRead: false }],
  });
  expect(init).toMatchObject({
    method: "PATCH",
    cache: "no-store",
    credentials: "same-origin",
  });
  expect(harness.fetch.mock.calls[1][0]).toBe(
    "/api/notifications/inbox?q=topic&state=unread&category=content",
  );
  expect(harness.announce).toHaveBeenCalledTimes(1);
  expect(render().some((node) => node.type === "article")).toBe(false);
  expect(button(render(), "Mark selected as read").props.disabled).toBe(true);
});
it("saves exactly the visible selected rows and supports unread state", async () => {
  const checkbox = render().find(
    (node) => node.type === "input" && node.props.id !== "notification-inbox-selection-confirm",
  );
  if (!checkbox) throw Error("Missing page selection");
  (checkbox.props.onChange as (event: unknown) => void)({
    target: { checked: true },
  });
  acknowledgeSelection();
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ isRead: false, ids: ["owned"] }))
    .mockResolvedValueOnce(response(initialPage));
  click(render(), "Mark selected as unread");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({
    isRead: false,
    items: [{ id: "owned", expectedIsRead: false }],
  });
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Mark selected as unread",
      consequences: expect.stringContaining("outside the selection"),
    }),
  );
});
it("requires selection acknowledgement and confirmAction before batch read or unread writes", async () => {
  const pageSelect = render().find(
    (node) => node.type === "input" && node.props.id !== "notification-inbox-selection-confirm",
  );
  if (!pageSelect) throw Error("Missing page selection");
  (pageSelect.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  click(render(), "Mark selected as read");
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(confirmAction).not.toHaveBeenCalled();
  acknowledgeSelection();
  confirmAction.mockReset().mockResolvedValueOnce(false);
  click(render(), "Mark selected as read");
  expect(harness.fetch).not.toHaveBeenCalled();
  confirmAction.mockReset().mockResolvedValueOnce(true);
  click(render(), "Mark selected as read");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Mark selected as read" }),
  );
});
it("clears selection acknowledgement when the page selection changes", () => {
  acknowledgeSelection();
  const pageSelect = render().find(
    (node) => node.type === "input" && node.props.id !== "notification-inbox-selection-confirm",
  );
  if (!pageSelect) throw Error("Missing page selection");
  (pageSelect.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  expect(selectionConfirmCheckbox().props.checked).toBe(false);
  expect(button(render(), "Mark selected as read").props.disabled).toBe(true);
});
it("preserves explicit whole-inbox reading with a scope warning, cancellation and saved-state refresh", async () => {
  confirmAction.mockReset().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ success: true, scope: "all" }))
    .mockResolvedValueOnce(response(refreshed));
  click(render(), "Mark entire inbox as read");
  expect(harness.fetch).not.toHaveBeenCalled();
  click(render(), "Mark entire inbox as read");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      consequences: expect.stringContaining("outside this page"),
    }),
  );
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/notifications/mark-read");
  expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
  expect(harness.fetch.mock.calls[0][1]).not.toHaveProperty("body");
});
it("hides empty copy while a refresh is in flight and restores it only after success", async () => {
  harness.slots = [];
  harness.cursor = 0;
  const emptyPage = {
    items: [],
    unreadCount: 0,
    olderCursor: null,
    newerCursor: null,
  };
  const emptyFiltered =
    "No matching notifications on this page. Try another filter or return to the latest page.";
  harness.slots[0] = emptyPage;
  let complete!: (value: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(render(), "Reload saved inbox");
  expect(render().some((node) => node.props.children === emptyFiltered)).toBe(false);
  expect(render().some((node) => node.props.children === "Refreshing notifications…")).toBe(true);
  complete(response(emptyPage));
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.children === emptyFiltered)).toBe(true),
  );
});
it("does not send a page selection larger than twenty-five notifications", async () => {
  const oversized = {
    ...initialPage,
    items: Array.from({ length: 26 }, (_, n) => ({
      ...initialPage.items[0],
      id: `owned_${n}`,
    })),
  };
  harness.slots = [];
  harness.cursor = 0;
  harness.slots[0] = oversized;
  harness.slots[1] = oversized.items.map((item) => item.id);
  harness.fetch.mockReset();
  click(render(), "Mark selected as read");
  expect(harness.fetch).not.toHaveBeenCalled();
});
it("keeps the last confirmed unread count after a conflicting expectedIsRead write", async () => {
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ code: "NOTIFICATION_STATE_CHANGED" }, 409));
  expect(render().some((node) => node.type === "strong" && node.props.children === 2)).toBe(true);
  click(render(), "Mark as read");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(render().some((node) => node.type === "strong" && node.props.children === 2)).toBe(true);
  expect(harness.announce).not.toHaveBeenCalled();
});
it("coalesces rapid commands while a write or refresh is pending", async () => {
  let complete!: (value: Response) => void;
  harness.fetch
    .mockReset()
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
    )
    .mockResolvedValueOnce(response(refreshed));
  const nodes = render();
  click(nodes, "Mark as read");
  click(nodes, "Mark as read");
  click(nodes, "Reload saved inbox");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(
    render().some((node) => node.props.role === "status" && node.props["aria-busy"] === "true"),
  ).toBe(true);
  complete(response({ isRead: true, ids: ["owned"] }));
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
});
it.each([
  { reply: response({ isRead: true, ids: ["foreign"] }) },
  { reply: new Response("broken") },
  { reply: response({ code: "NOTIFICATION_STATE_CHANGED" }, 409) },
])("blocks unconfirmed or conflicting writes until a successful reload", async ({ reply }) => {
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(reply)
    .mockResolvedValueOnce(response(initialPage));
  click(render(), "Mark as read");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.announce).not.toHaveBeenCalled();
  expect(button(render(), "Mark as read").props.disabled).toBe(true);
  click(render(), "Mark as read");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  click(render(), "Reload saved inbox");
  await vi.waitFor(() => expect(button(render(), "Mark as read").props.disabled).toBe(false));
});
it("does not report success when a confirmed write cannot be reread", async () => {
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ isRead: true, ids: ["owned"] }))
    .mockRejectedValueOnce(new Error("PRIVATE_NETWORK_ERROR"));
  click(render(), "Mark as read");
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(button(render(), "Mark as read").props.disabled).toBe(true);
  expect(render().filter((node) => node.props.role === "alert")[0].props.children).not.toContain(
    "PRIVATE_NETWORK_ERROR",
  );
  expect(harness.announce).toHaveBeenCalledTimes(1);
});
it("aborts outstanding client reads on navigation and skips later announcements", async () => {
  let complete!: (value: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  click(render(), "Mark as read");
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  complete(response({ isRead: true, ids: ["owned"] }));
  await new Promise((resolve) => setImmediate(resolve));
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.announce).not.toHaveBeenCalled();
});

const exportReport = {
  version: 1,
  scope: "notification-inbox-page",
  locale: "en",
  filters: { ...filters, period: "all" },
  window: null,
  items: initialPage.items.map(({ link: _link, ...item }) => item),
  hasOlder: false,
  hasNewer: false,
};
function exportResponse(value: unknown = exportReport) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="nexus-notification-page.json"',
    },
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
function browserDownload() {
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
it("prepares a verified export without changing selected or read notifications and releases its object URL", async () => {
  const browser = browserDownload();
  const checkbox = render().find((node) => node.type === "input");
  if (!checkbox) throw Error("Missing checkbox");
  (checkbox.props.onChange as (event: unknown) => void)({
    target: { checked: true },
  });
  acknowledgeSelection();
  harness.fetch.mockReset().mockResolvedValueOnce(exportResponse());
  exportClick();
  expect(render().some((node) => node.props.children === "Preparing notification export…")).toBe(
    true,
  );
  await vi.waitFor(() => expect(browser.link.click).toHaveBeenCalledTimes(1));
  expect(browser.link).toMatchObject({
    href: "blob:nexus-test",
    download: "nexus-notification-page.json",
  });
  expect(browser.link.remove).toHaveBeenCalledTimes(1);
  expect(browser.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(harness.fetch.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
  });
  expect(render().find((node) => node.type === "input")?.props.checked).toBe(true);
  expect(render().some((node) => node.type === "article")).toBe(true);
  expect(button(render(), "Mark selected as read").props.disabled).toBe(false);
  expect(harness.announce).not.toHaveBeenCalled();
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(browser.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:nexus-test");
});
it.each([
  [response({ code: "UNAUTHORIZED" }, 401), "Sign in to view your notifications."],
  [response({ code: "RATE_LIMIT_EXCEEDED" }, 429), "Too many requests. Try again shortly."],
  [
    exportResponse({ ...exportReport, locale: "ru" }),
    "The export could not be verified. Try again.",
  ],
])(
  "shows an export failure on the page and permits retry without blocking read controls",
  async (reply, message) => {
    const browser = browserDownload();
    harness.fetch.mockReset().mockResolvedValueOnce(reply).mockResolvedValueOnce(exportResponse());
    exportClick();
    await vi.waitFor(() =>
      expect(
        render().some((node) => node.props.role === "alert" && node.props.children === message),
      ).toBe(true),
    );
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(button(render(), "Mark as read").props.disabled).toBe(false);
    exportClick();
    await vi.waitFor(() => expect(browser.link.click).toHaveBeenCalledTimes(1));
    expect(harness.fetch).toHaveBeenCalledTimes(2);
  },
);
it("coalesces repeated export clicks and prevents writes during file preparation", async () => {
  const browser = browserDownload();
  let complete!: (response: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const nodes = render();
  exportClick(nodes);
  exportClick(nodes);
  click(nodes, "Mark as read");
  click(nodes, "Reload saved inbox");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  complete(exportResponse());
  await vi.waitFor(() => expect(browser.link.click).toHaveBeenCalledTimes(1));
  expect(harness.announce).not.toHaveBeenCalled();
});
it("aborts an export on navigation, ignores late replies and rejects stale click handlers", async () => {
  const browser = browserDownload();
  let complete!: (response: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const nodes = render();
  exportClick(nodes);
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  complete(exportResponse());
  await new Promise((resolve) => setImmediate(resolve));
  exportClick(nodes);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(browser.createObjectURL).not.toHaveBeenCalled();
  expect(browser.link.click).not.toHaveBeenCalled();
});

it("cancels a stalled export on timeout and shows a retryable message", async () => {
  const browser = browserDownload(),
    timeout = new AbortController();
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const cancel = vi.fn();
  harness.fetch.mockReset().mockResolvedValueOnce(
    new Response(new ReadableStream({ cancel }), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="nexus-notification-page.json"',
      },
    }),
  );
  try {
    exportClick();
    await new Promise((resolve) => setImmediate(resolve));
    timeout.abort(new DOMException("Timed out", "TimeoutError"));
    await vi.waitFor(() =>
      expect(
        render().some(
          (node) =>
            node.props.role === "alert" &&
            node.props.children === "The export took too long. Try again.",
        ),
      ).toBe(true),
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(exportLink()).toBeDefined();
    expect(button(render(), "Mark as read").props.disabled).toBe(false);
  } finally {
    timeoutSpy.mockRestore();
  }
});
