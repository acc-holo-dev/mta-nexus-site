import { expect, it, vi } from "vitest";
import {
  createNotificationBellInteractionHelpers,
  mockReactHooks,
  notificationBellDictionary,
  response,
  sample,
} from "../../tests/helpers/notification-bell-interaction-harness";

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

const { render, bellButton, openPopover, markAllButton } = createNotificationBellInteractionHelpers(
  harness,
  NotificationBell,
  confirmAction,
);

it("opens only one confirmation for repeated mark-all clicks and allows retry after cancel", async () => {
  harness.fetch.mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  let finish!: (confirmed: boolean) => void;
  confirmAction
    .mockReturnValueOnce(new Promise<boolean>((resolve) => (finish = resolve)))
    .mockResolvedValueOnce(false);
  const click = markAllButton().props.onClick as () => void;
  click();
  click();
  expect(confirmAction).toHaveBeenCalledTimes(1);
  finish(false);
  await vi.waitFor(() => {
    click();
    expect(confirmAction).toHaveBeenCalledTimes(2);
  });
});

it("ignores repeated mark-all clicks while the confirmed request is pending", async () => {
  harness.fetch.mockResolvedValueOnce(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
  const click = markAllButton().props.onClick as () => void;
  click();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  click();
  expect(confirmAction).toHaveBeenCalledTimes(1);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body)).toEqual({ expectedActorId: "usr_1" });
  finish(response({ success: true, scope: "all" }));
  await vi.waitFor(() => expect(harness.announce).toHaveBeenCalledOnce());
});

it("preserves confirmed unread counts when account-wide mark-all fails", async () => {
  harness.fetch
    .mockResolvedValueOnce(response(sample))
    .mockResolvedValueOnce(response({ error: "failed" }, 500))
    .mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() => expect(bellButton().props["aria-label"]).toBe("3 unread notifications"));
  await (markAllButton().props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalled();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(bellButton().props["aria-label"]).toBe("3 unread notifications");
  expect(harness.fetch.mock.calls.some(([url]) => url === "/api/notifications/mark-read")).toBe(
    true,
  );
});
