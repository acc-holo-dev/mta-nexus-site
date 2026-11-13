import { expect, it, vi } from "vitest";
import { flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";
import {
  browserDownload,
  createNotificationInboxInteractionHelpers,
  exportReport,
  exportResponse,
  mockReactHooks,
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
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../../site/src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../../site/src/components/notification-inbox";

const { render, button, acknowledgeSelection, exportClick } =
  createNotificationInboxInteractionHelpers(harness, NotificationInbox);

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
    await vi.waitFor(() => expect(flatTreeHasErrorText(render(), message)).toBe(true));
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(button(render(), "Mark as read").props.disabled).toBe(false);
    exportClick();
    await vi.waitFor(() => expect(browser.link.click).toHaveBeenCalledTimes(1));
    expect(harness.fetch).toHaveBeenCalledTimes(2);
  },
);
