import type { Locale } from "./i18n";
import type { Notification } from "@nexus/domain";

/** Localize structured review notices; older notifications keep their stored text. */
export function formatNotification(
  notification: Pick<Notification, "title" | "message" | "data">,
  copy: { approved: string; rejected: string; version: string; notes: string },
  locale: Locale = "en",
) {
  // These notices predate structured review payloads; localize their bounded,
  // server-generated template without changing persisted notification contracts.
  const comment =
    notification.title === "New article comment" &&
    /^@([a-zA-Z0-9_-]{1,80}) commented on “([\s\S]{1,200})”\.$/u.exec(notification.message);
  if (comment)
    return {
      title: locale === "ru" ? "Новый комментарий" : "New comment",
      message:
        locale === "ru"
          ? `@${comment[1]} оставил комментарий к «${comment[2]}».`
          : notification.message,
    };
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
