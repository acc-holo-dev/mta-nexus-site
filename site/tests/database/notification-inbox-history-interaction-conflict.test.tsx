import { expect, it, vi } from "vitest";
import {
  createNotificationInboxInteractionHelpers,
  initialPage,
  mockReactHooks,
  refreshed,
  response,
} from "../helpers/notification-inbox-history-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../../src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../../src/components/notification-inbox";

const { render, button, click } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

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
