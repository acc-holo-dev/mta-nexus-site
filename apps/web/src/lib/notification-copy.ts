import type { Notification } from "@nexus/domain";
import type { Locale } from "./i18n";

/** Localize structured review notices; older notifications keep their stored text. */
export function formatNotification(
  notification: Pick<Notification, "title" | "message" | "data">,
  copy: { approved: string; rejected: string; version: string; notes: string },
  locale: Locale = "en",
) {
  const publication =
    notification.title === "Publication activity" &&
    /^Publication ([a-zA-Z0-9_-]{1,128}): (created|edited|published|archived)\.$/u.exec(
      notification.message,
    );
  if (publication) {
    const messages: Record<string, string> =
      locale === "ru"
        ? {
            created: "Создана публикация в вашем контексте.",
            edited: "Публикация изменена. Статьи и новости возвращены на модерацию.",
            published: "Модератор опубликовал материал.",
            archived: "Публикация перенесена в архив.",
          }
        : {
            created: "A publication was created in your context.",
            edited: "The publication changed. Editorial content returned to moderation.",
            published: "A moderator published the material.",
            archived: "The publication was archived.",
          };
    return {
      title: locale === "ru" ? "Обновление публикации" : "Publication activity",
      message: messages[publication[2]],
    };
  }
  const supportActivity =
    notification.title === "Support case activity" &&
    /^Support case (sup_[a-f0-9]{24}): (reply|open|resolved|closed)\.$/u.exec(notification.message);
  if (supportActivity) {
    const messages: Record<string, string> =
      locale === "ru"
        ? {
            reply: "Поддержка ответила на ваше обращение.",
            open: "Обращение переоткрыто.",
            resolved: "Обращение отмечено решённым.",
            closed: "Обращение закрыто поддержкой.",
          }
        : {
            reply: "Support replied to your case.",
            open: "Your case was reopened.",
            resolved: "Your case was marked as resolved.",
            closed: "Support closed your case.",
          };
    return {
      title: locale === "ru" ? "Обновление обращения" : "Support case activity",
      message: messages[supportActivity[2]],
    };
  }
  if (
    notification.title === "New support case" &&
    notification.message === "A support case is awaiting review."
  )
    return {
      title: locale === "ru" ? "Новое обращение" : notification.title,
      message: locale === "ru" ? "Обращение ожидает рассмотрения." : notification.message,
    };
  if (
    notification.title === "Support case updated" &&
    notification.message === "A support case has a new requester message."
  )
    return {
      title: locale === "ru" ? "Новое сообщение в обращении" : notification.title,
      message:
        locale === "ru" ? "Пользователь добавил сообщение в обращение." : notification.message,
    };
  const organizationAccess =
    notification.title === "Organization access changed" &&
    /^Organization ([a-zA-Z0-9_-]{1,128}): (added|updated|removed|left|ownership_gained|ownership_transferred)\.$/u.exec(
      notification.message,
    );
  if (organizationAccess) {
    const messages: Record<string, string> =
      locale === "ru"
        ? {
            added: "Вас добавили в команду.",
            updated: "Ваша роль или делегированный доступ изменены.",
            removed: "Ваш доступ к команде отозван.",
            left: "Вы вышли из команды.",
            ownership_gained: "Вам передано владение организацией.",
            ownership_transferred: "Вы передали владение организацией.",
          }
        : {
            added: "You were added to the team.",
            updated: "Your role or delegated access changed.",
            removed: "Your team access was revoked.",
            left: "You left the team.",
            ownership_gained: "Organization ownership was transferred to you.",
            ownership_transferred: "You transferred organization ownership.",
          };
    return {
      title: locale === "ru" ? "Доступ к организации изменён" : notification.title,
      message: messages[organizationAccess[2]],
    };
  }
  const verification =
    /^([a-z]+) verification for ([a-zA-Z0-9_-]{1,128}) was (approved|rejected)\.$/u.exec(
      notification.message,
    );
  if (
    verification &&
    ["user", "developer", "organization", "server"].includes(verification[1]) &&
    notification.title === `Verification ${verification[3]}`
  ) {
    const labels: Record<string, string> = {
      user: "Подтверждение личности",
      developer: "Подтверждение опыта разработчика",
      organization: "Подтверждение организации",
      server: "Подтверждение контроля сервера",
    };
    return {
      title:
        locale === "ru"
          ? verification[3] === "approved"
            ? "Верификация одобрена"
            : "Верификация отклонена"
          : notification.title,
      message:
        locale === "ru"
          ? `${labels[verification[1]]} ${verification[3] === "approved" ? "одобрено" : "отклонено"}.`
          : notification.message,
    };
  }
  const requested =
    /^(user|developer|organization|server) verification requested for ([a-zA-Z0-9_-]{1,128})$/u.exec(
      notification.message,
    );
  if (notification.title === "New verification request" && requested && locale === "ru") {
    const labels: Record<string, string> = {
      user: "личности",
      developer: "опыта разработчика",
      organization: "организации",
      server: "контроля сервера",
    };
    return {
      title: "Новая заявка на верификацию",
      message: `Подтверждение ${labels[requested[1]]}: ${requested[2]}.`,
    };
  }
  if (
    notification.title === "New community report" &&
    notification.message === "A community report is awaiting review."
  )
    return {
      title: locale === "ru" ? "Новая жалоба сообщества" : notification.title,
      message: locale === "ru" ? "Жалоба сообщества ожидает рассмотрения." : notification.message,
    };
  const reportStatus =
    notification.title === "Community report status" &&
    /^Report status: (under_review|resolved|dismissed)\.$/u.exec(notification.message);
  if (reportStatus) {
    const statuses: Record<string, string> = {
      under_review: "рассматривается",
      resolved: "решена",
      dismissed: "отклонена",
    };
    return {
      title: locale === "ru" ? "Статус жалобы" : notification.title,
      message: locale === "ru" ? `Жалоба ${statuses[reportStatus[1]]}.` : notification.message,
    };
  }
  const follower =
    notification.title === "New Follower" &&
    /^@([a-zA-Z0-9_-]{1,80}) started following your activity\.$/u.exec(notification.message);
  if (follower)
    return {
      title: locale === "ru" ? "Новый подписчик" : "New follower",
      message:
        locale === "ru" ? `@${follower[1]} подписался на вашу активность.` : notification.message,
    };
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
