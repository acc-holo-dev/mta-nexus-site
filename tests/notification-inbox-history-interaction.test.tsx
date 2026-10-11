import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
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

const filters = { query: "topic", state: "unread" as const, category: "content" as const };
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
const refreshed = { items: [], unreadCount: 1, olderCursor: null, newerCursor: null };
type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...descendants(element.props.children as ReactNode)];
}
function render() {
  harness.cursor = 0;
  return descendants(NotificationInbox({ initialPage, filters }));
}
function button(nodes: Element[], label: string) {
  const found = nodes.find((node) => node.type === "button" && node.props.children === label);
  if (!found) throw Error(`Missing ${label}`);
  return found;
}
function click(nodes: Element[], label: string) {
  return (button(nodes, label).props.onClick as () => void)();
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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
  expect(init).toMatchObject({ method: "PATCH", cache: "no-store", credentials: "same-origin" });
  expect(harness.fetch.mock.calls[1][0]).toBe(
    "/api/notifications/inbox?q=topic&state=unread&category=content",
  );
  expect(harness.announce).toHaveBeenCalledTimes(1);
  expect(render().some((node) => node.type === "article")).toBe(false);
  expect(button(render(), "Mark selected as read").props.disabled).toBe(true);
});
it("saves exactly the visible selected rows and supports unread state", async () => {
  const checkbox = render().find((node) => node.type === "input");
  if (!checkbox) throw Error("Missing page selection");
  (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
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
});
it("preserves explicit whole-inbox reading with a scope warning, cancellation and saved-state refresh", async () => {
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  vi.stubGlobal("window", { confirm });
  harness.fetch
    .mockReset()
    .mockResolvedValueOnce(response({ success: true, scope: "all" }))
    .mockResolvedValueOnce(response(refreshed));
  click(render(), "Mark entire inbox as read");
  expect(harness.fetch).not.toHaveBeenCalled();
  click(render(), "Mark entire inbox as read");
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("outside this page"));
  expect(harness.fetch.mock.calls[0][0]).toBe("/api/notifications/mark-read");
  expect(harness.fetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
  expect(harness.fetch.mock.calls[0][1]).not.toHaveProperty("body");
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
  expect(render()[0].props["aria-busy"]).toBe(true);
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
