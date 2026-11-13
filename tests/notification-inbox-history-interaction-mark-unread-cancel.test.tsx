import { expect, it, vi } from "vitest";
import {
  createNotificationInboxInteractionHelpers,
  mockReactHooks,
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

const { render, click, acknowledgeSelection } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

it("does not PATCH when Mark selected as unread confirmation is cancelled", async () => {
  const pageSelect = render().find(
    (node) => node.type === "input" && node.props.id !== "notification-inbox-selection-confirm",
  );
  if (!pageSelect) throw Error("Missing page selection");
  (pageSelect.props.onChange as (event: unknown) => void)({ target: { checked: true } });
  acknowledgeSelection();
  harness.fetch.mockReset();
  confirmAction.mockResolvedValueOnce(false);
  click(render(), "Mark selected as unread");
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Mark selected as unread",
    }),
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});
