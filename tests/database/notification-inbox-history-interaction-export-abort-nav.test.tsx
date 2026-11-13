import { expect, it, vi } from "vitest";
import {
  browserDownload,
  createNotificationInboxInteractionHelpers,
  exportResponse,
  mockReactHooks,
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

const { render, exportClick } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

it("aborts an export on navigation, ignores late replies and rejects stale click handlers", async () => {
  const browser = browserDownload();
  let complete!: (response: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const nodes = render();
  exportClick(nodes);
  const signal = harness.fetch.mock.calls[0][1].signal;
  for (const cleanup of harness.cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  complete(exportResponse());
  await new Promise((resolve) => setImmediate(resolve));
  exportClick(nodes);
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  expect(browser.createObjectURL).not.toHaveBeenCalled();
  expect(browser.link.click).not.toHaveBeenCalled();
});
