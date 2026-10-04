import type { Notification } from "@nexus/domain";

/** Localize structured review notices; older notifications keep their stored text. */
export function formatNotification(
  notification: Pick<Notification, "title" | "message" | "data">,
  copy: { approved: string; rejected: string; version: string; notes: string },
) {
  const data = notification.data;
  if (
    data?.kind !== "build_review" ||
    (data.decision !== "approve" && data.decision !== "reject") ||
    typeof data.resourceTitle !== "string" ||
    typeof data.version !== "string" ||
    typeof data.notes !== "string"
  ) {
    return { title: notification.title, message: notification.message };
  }
  return {
    title: data.decision === "approve" ? copy.approved : copy.rejected,
    message: `${data.resourceTitle} · ${copy.version} ${data.version}${data.notes ? `\n${copy.notes}: ${data.notes}` : ""}`,
  };
}
