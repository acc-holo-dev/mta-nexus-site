import { expect, it, vi } from "vitest";
import {
  createNotificationInboxInteractionHelpers,
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
vi.mock("../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../site/src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../site/src/components/notification-inbox";

const { render, button, click, acknowledgeSelection, selectionConfirmCheckbox } =
  createNotificationInboxInteractionHelpers(harness, NotificationInbox);

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
  expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toEqual({ expectedActorId: "usr_1" });
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
