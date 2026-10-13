import type { DiscussionPushNotificationData } from "@nexus/domain";

type PushState = "pending" | "queued" | "unavailable";
/** This is evidence of queue admission, never evidence that a provider delivered the push. */
export function discussionPushReceipt(data: unknown): PushState | null {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length !== 2 ||
    !("kind" in data) ||
    data.kind !== "discussion_push" ||
    !("discussionPush" in data)
  )
    return null;
  const receipt = data.discussionPush;
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    Object.keys(receipt).length !== 2 ||
    !("version" in receipt) ||
    receipt.version !== 1 ||
    !("state" in receipt)
  )
    return null;
  return typeof receipt.state === "string" &&
    ["pending", "queued", "unavailable"].includes(receipt.state)
    ? (receipt.state as PushState)
    : null;
}
export function withDiscussionPushReceipt(state: PushState): DiscussionPushNotificationData {
  return { kind: "discussion_push", discussionPush: { version: 1, state } };
}
