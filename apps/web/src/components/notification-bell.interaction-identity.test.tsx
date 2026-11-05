import { expect, it, vi } from "vitest";
import {
  createNotificationBellInteractionHelpers,
  mockReactHooks,
  notificationBellDictionary,
  response,
  sample,
} from "../../../../tests/helpers/notification-bell-interaction-harness";

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

import { NotificationBell } from "./notification-bell";

const { bellButton, openPopover, markAllButton } = createNotificationBellInteractionHelpers(
  harness,
  NotificationBell,
  confirmAction,
);

it("keeps the confirmed account if the preview changes during confirmation", async () => {
  harness.fetch.mockResolvedValueOnce(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  let finish!: (confirmed: boolean) => void;
  confirmAction.mockReturnValueOnce(new Promise<boolean>((resolve) => (finish = resolve)));
  harness.fetch.mockResolvedValueOnce(response({ code: "ACCOUNT_CHANGED" }, 409));
  (markAllButton().props.onClick as () => void)();
  harness.slots[2] = "usr_other";
  bellButton();
  finish(true);
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({ expectedActorId: "usr_1" });
  expect(harness.announce).not.toHaveBeenCalled();
});

it("does not send mark-all after unmount while confirmation is pending", async () => {
  harness.fetch.mockResolvedValueOnce(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  let finish!: (confirmed: boolean) => void;
  confirmAction.mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      finish = resolve;
    }),
  );
  (markAllButton().props.onClick as () => void)();
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  finish(true);
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledOnce());
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});

it("aborts an in-flight mark-all on unmount and ignores its late response", async () => {
  harness.fetch.mockResolvedValueOnce(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  (markAllButton().props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  const signal = harness.fetch.mock.calls[1][1].signal as AbortSignal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  finish(response({ success: true, scope: "all" }));
  await Promise.resolve();
  await Promise.resolve();
  expect(harness.announce).not.toHaveBeenCalled();
});
