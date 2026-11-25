/** A counted thread with no rows is a failed page. Zero total is an empty conversation. */
export function supportThreadMessageFrame(messageCount: number, messageTotal: number) {
  if (messageCount === 0 && messageTotal > 0) return "load-error" as const;
  if (messageCount === 0) return "empty" as const;
  return "messages" as const;
}
