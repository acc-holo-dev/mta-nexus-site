import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  announceNotificationInboxChange,
  observeNotificationInboxChange,
} from "../apps/web/src/lib/notification-inbox-events";

const channels: Channel[] = [];
class Channel {
  onmessage?: (event: { data: unknown }) => void;
  postMessage = vi.fn();
  close = vi.fn();
  constructor(readonly name: string) {
    channels.push(this);
  }
}
beforeEach(() => {
  channels.length = 0;
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("window", { BroadcastChannel: Channel });
});
afterEach(() => vi.unstubAllGlobals());
it("refreshes the local bell and sends only an invalidation to other tabs", () => {
  const refresh = vi.fn(),
    stop = observeNotificationInboxChange(refresh);
  announceNotificationInboxChange();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(channels[1].postMessage).toHaveBeenCalledExactlyOnceWith("changed");
  expect(channels[1].close).toHaveBeenCalledTimes(1);
  stop();
});
it("ignores unrecognized channel payloads and removes all listeners on cleanup", () => {
  const refresh = vi.fn(),
    stop = observeNotificationInboxChange(refresh);
  channels[0].onmessage?.({ data: { unreadCount: 99, recipientId: "foreign" } });
  expect(refresh).not.toHaveBeenCalled();
  channels[0].onmessage?.({ data: "changed" });
  expect(refresh).toHaveBeenCalledTimes(1);
  stop();
  announceNotificationInboxChange();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(channels[0].close).toHaveBeenCalledTimes(1);
});
it("works with local events when BroadcastChannel is unavailable", () => {
  vi.stubGlobal("window", {});
  const refresh = vi.fn(),
    stop = observeNotificationInboxChange(refresh);
  announceNotificationInboxChange();
  expect(refresh).toHaveBeenCalledTimes(1);
  stop();
});
it("keeps local invalidation usable when the browser blocks channels", () => {
  vi.stubGlobal("window", {
    BroadcastChannel: class {
      constructor() {
        throw Error("blocked");
      }
    },
  });
  const refresh = vi.fn(),
    stop = observeNotificationInboxChange(refresh);
  expect(() => announceNotificationInboxChange()).not.toThrow();
  expect(refresh).toHaveBeenCalledTimes(1);
  stop();
});
