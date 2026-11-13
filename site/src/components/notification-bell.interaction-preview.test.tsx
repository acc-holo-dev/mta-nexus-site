import { expect, it, vi } from "vitest";
import {
  createNotificationBellInteractionHelpers,
  mockReactHooks,
  notificationBellDictionary,
  response,
  sample,
  textOf,
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

const { render, bellButton, openPopover } = createNotificationBellInteractionHelpers(
  harness,
  NotificationBell,
  confirmAction,
);

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
  complete(response({ actorId: "usr_1", notifications: [], unreadCount: 0 }));
  await vi.waitFor(() =>
    expect(render().some((node) => textOf(node).includes("No notifications yet"))).toBe(true),
  );
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(false);
});

it("keeps a first-load failure distinct from empty and does not confirm a zero badge", async () => {
  harness.fetch.mockResolvedValueOnce(response({ error: "boom" }, 500));
  openPopover();
  await vi.waitFor(() => expect(render().some((node) => node.props.role === "alert")).toBe(true));
  expect(render().some((node) => textOf(node).includes("No notifications yet"))).toBe(false);
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(false);
  expect(bellButton().props["aria-busy"]).toBeUndefined();
  expect(bellButton().props["aria-label"]).toBe("Notifications");
  expect(
    render().some(
      (node) =>
        typeof node.props.className === "string" &&
        node.props.className.includes("bg-accent") &&
        textOf(node) === "0",
    ),
  ).toBe(false);
  const retry = render().find((node) => node.type === "button" && textOf(node) === "Retry");
  if (!retry) throw Error("Missing retry");
  (retry.props.onClick as () => void)();
  expect(render().some((node) => textOf(node).includes("Loading notifications..."))).toBe(true);
  expect(bellButton().props["aria-busy"]).toBe(true);
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

it("keeps destination links from marking notifications read", async () => {
  harness.fetch.mockResolvedValue(response(sample));
  openPopover();
  await vi.waitFor(() =>
    expect(
      render().some((node) => node.type === "a" && node.props.href === "/articles/topic"),
    ).toBe(true),
  );
  const link = render().find((node) => node.type === "a" && node.props.href === "/articles/topic");
  if (!link) throw new Error("expected topic link in notification popover");
  (link.props.onClick as () => void)();
  expect(
    harness.fetch.mock.calls.some(
      ([url, init]) =>
        String(url).includes("mark-read") ||
        (String(url).includes("/inbox") && init?.method === "PATCH"),
    ),
  ).toBe(false);
});
