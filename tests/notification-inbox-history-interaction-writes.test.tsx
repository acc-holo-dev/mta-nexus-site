import { expect, it, vi } from "vitest";
import { flattenReactTestTree } from "./helpers/flatten-react-test-tree";
import {
  createNotificationInboxInteractionHelpers,
  filters,
  initialPage,
  mockReactHooks,
  refreshed,
  response,
} from "./helpers/notification-inbox-history-interaction-harness";

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
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../apps/web/src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../apps/web/src/components/notification-inbox";

const { render, button, click, acknowledgeSelection, selectionConfirmCheckbox } =
  createNotificationInboxInteractionHelpers(harness, NotificationInbox);

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
it("shows EmptyState descriptions for empty and filtered notification pages", () => {
  const emptyPage = {
    items: [],
    unreadCount: 0,
    olderCursor: null,
    newerCursor: null,
  };
  harness.slots = [];
  harness.cursor = 0;
  const unfiltered = flattenReactTestTree(
    NotificationInbox({
      initialPage: emptyPage,
      filters: { query: "", state: "all", category: "all" },
    }),
  );
  expect(
    unfiltered.some(
      (node) =>
        node.props.title === "No notifications yet." &&
        node.props.description ===
          "New notifications appear here when activity reaches your account.",
    ),
  ).toBe(true);
  harness.slots = [];
  harness.cursor = 0;
  const filtered = flattenReactTestTree(NotificationInbox({ initialPage: emptyPage, filters }));
  const filteredEmpty = filtered.find(
    (node) =>
      node.props.title ===
      "No matching notifications on this page. Try another filter or return to the latest page.",
  );
  expect(filteredEmpty?.props.description).toBe(
    "Clear the filters or return to the latest page to continue.",
  );
  const reset = filteredEmpty?.props.action as
    | { props: { href?: string; children?: unknown } }
    | undefined;
  expect(reset?.props.href).toBe("/notifications");
  expect(reset?.props.children).toBe("Reset");
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
  expect(render().some((node) => node.props.title === emptyFiltered)).toBe(false);
  expect(render().some((node) => node.props.children === "Refreshing notifications…")).toBe(true);
  complete(response(emptyPage));
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === emptyFiltered)).toBe(true),
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
