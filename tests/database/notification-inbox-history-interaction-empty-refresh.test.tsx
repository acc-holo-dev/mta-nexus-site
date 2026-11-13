import { expect, it, vi } from "vitest";
import { flattenReactTestTree } from "../helpers/flatten-react-test-tree";
import {
  createNotificationInboxInteractionHelpers,
  filters,
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

const { render, button, click } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

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
      actorId: "usr_1",
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
  const filtered = flattenReactTestTree(
    NotificationInbox({ initialPage: emptyPage, filters, actorId: "usr_1" }),
  );
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
it("does not replace the loaded inbox when refresh returns another account", async () => {
  harness.fetch.mockResolvedValueOnce(response({ ...refreshed, actorId: "usr_other" }));
  click(render(), "Reload saved inbox");
  await vi.waitFor(() =>
    expect(button(render(), "Mark entire inbox as read").props.disabled).toBe(true),
  );
  expect(harness.slots[0]).toEqual(initialPage);
});
