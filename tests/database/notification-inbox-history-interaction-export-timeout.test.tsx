import { expect, it, vi } from "vitest";
import { flatTreeHasErrorText } from "../helpers/flatten-react-test-tree";
import {
  browserDownload,
  createNotificationInboxInteractionHelpers,
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
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" }),
}));
vi.mock("../../apps/web/src/lib/notification-inbox-events", () => ({
  announceNotificationInboxChange: harness.announce,
}));

import { NotificationInbox } from "../../apps/web/src/components/notification-inbox";

const { render, button, exportClick, exportLink } = createNotificationInboxInteractionHelpers(
  harness,
  NotificationInbox,
);

it("cancels a stalled export on timeout and shows a retryable message", async () => {
  const browser = browserDownload(),
    timeout = new AbortController();
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const cancel = vi.fn();
  harness.fetch.mockReset().mockResolvedValueOnce(
    new Response(new ReadableStream({ cancel }), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="nexus-notification-page.json"',
      },
    }),
  );
  try {
    exportClick();
    await new Promise((resolve) => setImmediate(resolve));
    timeout.abort(new DOMException("Timed out", "TimeoutError"));
    await vi.waitFor(() =>
      expect(flatTreeHasErrorText(render(), "The export took too long. Try again.")).toBe(true),
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(exportLink()).toBeDefined();
    expect(button(render(), "Mark as read").props.disabled).toBe(false);
  } finally {
    timeoutSpy.mockRestore();
  }
});
