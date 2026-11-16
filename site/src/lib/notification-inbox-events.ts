const eventName = "nexus:notification-inbox-changed";
const channelName = "nexus-notification-inbox";
// Only an invalidation signal crosses tabs; counts, messages and account IDs stay private.
export function announceNotificationInboxChange() {
  document.dispatchEvent(new Event(eventName));
  if (typeof window.BroadcastChannel !== "function") return;
  try {
    const channel = new window.BroadcastChannel(channelName);
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* Polling remains available if the browser disables channels. */
  }
}
export function observeNotificationInboxChange(refresh: () => void) {
  document.addEventListener(eventName, refresh);
  let channel: BroadcastChannel | undefined;
  try {
    if (typeof window.BroadcastChannel === "function") {
      channel = new window.BroadcastChannel(channelName);
      channel.onmessage = (event) => {
        if (event.data === "changed") refresh();
      };
    }
  } catch {
    /* Local invalidations and visible polling remain available. */
  }
  return () => {
    document.removeEventListener(eventName, refresh);
    channel?.close();
  };
}
