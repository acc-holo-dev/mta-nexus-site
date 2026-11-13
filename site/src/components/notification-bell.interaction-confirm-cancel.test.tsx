import { expect, it, vi } from "vitest";
import {
  createNotificationBellInteractionHelpers,
  mockReactHooks,
  notificationBellDictionary,
  response,
  sample,
} from "../../../tests/helpers/notification-bell-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
  observe: vi.fn(() => () => {}),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));

vi.mock("./confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("./locale-context", () => ({
  useNexusLocale: () => ({
    locale: "en",
    dictionary: notificationBellDictionary,
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

import { notificationInboxCopy } from "../lib/notification-inbox-copy";
import { NotificationBell } from "./notification-bell";

const { bellButton, openPopover, markAllButton } = createNotificationBellInteractionHelpers(
  harness,
  NotificationBell,
  confirmAction,
);

it("does not POST mark-read when mark-all confirmation is cancelled", async () => {
  const inboxCopy = notificationInboxCopy("en");
  harness.fetch.mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  const fetchCallsBeforeMark = harness.fetch.mock.calls.length;
  confirmAction.mockResolvedValueOnce(false);

  await (markAllButton().props.onClick as () => Promise<void>)();

  expect(confirmAction).toHaveBeenCalledWith({
    title: inboxCopy.markAllRead,
    object: inboxCopy.title,
    scope: "3",
    consequences: inboxCopy.allConfirm,
    confirmLabel: inboxCopy.markAllRead,
    cancelLabel: inboxCopy.reset,
    closeLabel: inboxCopy.reset,
    danger: false,
  });
  expect(harness.fetch.mock.calls.length).toBe(fetchCallsBeforeMark);
  expect(harness.fetch.mock.calls.some(([url]) => url === "/api/notifications/mark-read")).toBe(
    false,
  );
  expect(harness.announce).not.toHaveBeenCalled();
  expect(bellButton().props["aria-label"]).toBe("3 unread notifications");
});
