import { expect, it, vi } from "vitest";
import {
  createNotificationInboxInteractionHelpers,
  mockReactHooks,
  response,
} from "../../../tests/helpers/notification-inbox-history-interaction-harness";
import { getDictionary } from "../../lib/i18n";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  announce: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../shell/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
}));
vi.mock("./notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "./components/notification-inbox";
import { notificationInboxCopy } from "./notification-inbox-copy";

const { render, click } = createNotificationInboxInteractionHelpers(harness, NotificationInbox);
const copy = notificationInboxCopy("en");

it("shows a failed inbox reload as an error, not an empty notification list", async () => {
  harness.slots[0] = {
    items: [],
    unreadCount: 0,
    olderCursor: null,
    newerCursor: null,
  };
  harness.fetch.mockReset().mockResolvedValueOnce(response({ code: "INTERNAL" }, 503));
  click(render(), copy.retry);
  await vi.waitFor(() =>
    expect(render().some((node) => node.props.title === copy.unavailable)).toBe(true),
  );
  const tree = render();
  expect(tree.some((node) => node.props.title === copy.empty)).toBe(false);
  expect(tree.some((node) => node.props.title === copy.emptyFiltered)).toBe(false);
  expect(tree.some((node) => node.props.description === copy.formErrorHint)).toBe(true);
});
