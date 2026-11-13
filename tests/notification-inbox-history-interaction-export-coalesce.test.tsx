import { expect, it, vi } from "vitest";
import {
  browserDownload,
  createNotificationInboxInteractionHelpers,
  exportResponse,
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

const { render, click, exportClick } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

it("coalesces repeated export clicks and prevents writes during file preparation", async () => {
  const browser = browserDownload();
  let complete!: (response: Response) => void;
  harness.fetch.mockReset().mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      complete = resolve;
    }),
  );
  const nodes = render();
  exportClick(nodes);
  exportClick(nodes);
  click(nodes, "Mark as read");
  click(nodes, "Reload saved inbox");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
  complete(exportResponse());
  await vi.waitFor(() => expect(browser.link.click).toHaveBeenCalledTimes(1));
  expect(harness.announce).not.toHaveBeenCalled();
});
