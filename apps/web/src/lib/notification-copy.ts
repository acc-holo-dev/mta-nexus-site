import type { Notification } from "@nexus/domain";
import type { Locale } from "./i18n";
import { licenseTermNotification } from "./license-maintenance-i18n";
import { resourceReleaseNotification } from "./resource-release-watches-i18n";

/** Localize structured review notices; older notifications keep their stored text. */
export function formatNotification(
  notification: Pick<Notification, "title" | "message" | "data">,
  copy: { approved: string; rejected: string; version: string; notes: string },
  locale: Locale = "en",
) {
  const termNotice = licenseTermNotification(notification.data, locale);
  if (termNotice) return termNotice;
  const releaseNotice = resourceReleaseNotification(notification.data, locale);
  if (releaseNotice) return releaseNotice;
  if (
    notification.title === "Discussion moderation" &&
    /^Comment ([a-zA-Z0-9_-]{1,128}): removed\.$/u.test(notification.message)
  )
    return {
      title: locale === "ru" ? "Модерация обсуждения" : "Discussion moderation",
      message:
        locale === "ru"
          ? "Модератор удалил ваш комментарий. Откройте запись в рабочей области. Ответы сохранены."
          : "A moderator removed your comment. Open the discussion in your workspace. Replies remain.",
    };
  const publicationActivityMessages = (event: string): string | undefined => {
    const messages: Record<string, string> =
      locale === "ru"
        ? {
            created: "Создана публикация в вашем контексте.",
            edited: "Публикация изменена. Статьи и новости возвращены на модерацию.",
            published: "Модератор опубликовал материал.",
            archived: "Публикация перенесена в архив.",
            restored: "Публикация восстановлена в черновик и остаётся непубличной.",
          }
        : {
            created: "A publication was created in your context.",
            edited: "The publication changed. Editorial content returned to moderation.",
            published: "A moderator published the material.",
            archived: "The publication was archived.",
            restored: "The publication was restored to a draft and remains private.",
          };
    return messages[event];
  };
  const withContentTitle = (message: string, title: unknown) => {
    const trimmed = typeof title === "string" ? title.trim().slice(0, 200) : "";
    return trimmed ? `${message} (${trimmed})` : message;
  };
  if (notification.data?.kind === "content_reaction") {
    return {
      title: locale === "ru" ? "Реакция на публикацию" : "Publication reaction",
      message: withContentTitle(
        locale === "ru"
          ? "Читатель оставил реакцию на вашу публикацию."
          : "A reader reacted to your publication.",
        notification.data.contentTitle,
      ),
    };
  }
  if (notification.data?.kind === "publication_activity") {
    const base = publicationActivityMessages(notification.data.event);
    if (base) {
      return {
        title: locale === "ru" ? "Обновление публикации" : "Publication activity",
        message: withContentTitle(base, notification.data.contentTitle),
      };
    }
  }
  if (
    notification.title === "Publication reaction" &&
    /^Publication ([a-zA-Z0-9_-]{1,128}): reaction\.$/u.test(notification.message)
  )
    return {
      title: locale === "ru" ? "Реакция на публикацию" : "Publication reaction",
      message:
        locale === "ru"
          ? "Читатель оставил реакцию на вашу публикацию."
          : "A reader reacted to your publication.",
    };
  const publication =
    notification.title === "Publication activity" &&
    /^Publication ([a-zA-Z0-9_-]{1,128}): (created|edited|published|archived|restored)\.$/u.exec(
      notification.message,
    );
  if (publication) {
    const message = publicationActivityMessages(publication[2]);
    if (message) {
      return {
        title: locale === "ru" ? "Обновление публикации" : "Publication activity",
        message,
      };
    }
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
  const organizationAccessMessages = (event: string): string | undefined => {
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
    return messages[event];
  };
  const organizationAccessData =
    notification.data?.kind === "organization_access" ? notification.data : null;
  if (organizationAccessData) {
    const base = organizationAccessMessages(organizationAccessData.event);
    if (base) {
      const name =
        typeof organizationAccessData.organizationName === "string"
          ? organizationAccessData.organizationName.trim().slice(0, 200)
          : "";
      return {
        title: locale === "ru" ? "Доступ к организации изменён" : "Organization access changed",
        message: name ? `${base} (${name})` : base,
      };
    }
  }
  const organizationAccess =
    notification.title === "Organization access changed" &&
    /^Organization ([a-zA-Z0-9_-]{1,128}): (added|updated|removed|left|ownership_gained|ownership_transferred)\.$/u.exec(
      notification.message,
    );
  if (organizationAccess) {
    const message = organizationAccessMessages(organizationAccess[2]);
    if (message) {
      return {
        title: locale === "ru" ? "Доступ к организации изменён" : notification.title,
        message,
      };
    }
  }
  const serverOwnership = /^Server ownership verification was (approved|rejected)\.$/u.exec(
    notification.message,
  );
  if (
    serverOwnership &&
    (notification.title === "Verification approved" ||
      notification.title === "Verification rejected")
  ) {
    return {
      title:
        locale === "ru"
          ? serverOwnership[1] === "approved"
            ? "Верификация одобрена"
            : "Верификация отклонена"
          : notification.title,
      message:
        locale === "ru"
          ? serverOwnership[1] === "approved"
            ? "Подтверждение контроля сервера одобрено."
            : "Подтверждение контроля сервера отклонено."
          : notification.message,
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
    const labelsRu: Record<string, string> = {
      user: "Подтверждение личности",
      developer: "Подтверждение опыта разработчика",
      organization: "Подтверждение организации",
      server: "Подтверждение контроля сервера",
    };
    const labelsEn: Record<string, string> = {
      user: "Identity verification",
      developer: "Developer experience verification",
      organization: "Organization verification",
      server: "Server ownership verification",
    };
    const approved = verification[3] === "approved";
    return {
      title:
        locale === "ru"
          ? approved
            ? "Верификация одобрена"
            : "Верификация отклонена"
          : notification.title,
      message:
        locale === "ru"
          ? `${labelsRu[verification[1]]} ${approved ? "одобрено" : "отклонено"}. Откройте заявку в рабочей области.`
          : `${labelsEn[verification[1]]} was ${verification[3]}. Open the application in your workspace.`,
    };
  }
  if (
    notification.title === "Server ownership proof requires review" &&
    notification.message === "A verified server control proof is awaiting review."
  ) {
    return {
      title:
        locale === "ru" ? "Доказательство контроля сервера требует проверки" : notification.title,
      message:
        locale === "ru"
          ? "Проверенное доказательство контроля сервера ожидает рассмотрения."
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
  if (
    notification.title === "New report" &&
    notification.message === "A report is awaiting review."
  )
    return {
      title: locale === "ru" ? "Новая жалоба" : notification.title,
      message: locale === "ru" ? "Жалоба ожидает рассмотрения." : notification.message,
    };
  const reportStatus =
    (notification.title === "Community report status" ||
      notification.title === "Platform report status") &&
    /^Report status: (under_review|resolved|dismissed)\.$/u.exec(notification.message);
  if (reportStatus) {
    const statuses: Record<string, string> = {
      under_review: "рассматривается",
      resolved: "решена",
      dismissed: "отклонена",
    };
    return {
      title:
        locale === "ru"
          ? notification.title === "Platform report status"
            ? "Статус жалобы платформы"
            : "Статус жалобы"
          : notification.title,
      message: locale === "ru" ? `Жалоба ${statuses[reportStatus[1]]}.` : notification.message,
    };
  }
  if (
    notification.title === "New discussion reply" &&
    [
      "A publication you follow has a new reply.",
      "A discussion you participate in has a new reply.",
    ].includes(notification.message)
  )
    return {
      title: locale === "ru" ? "Новый ответ в обсуждении" : notification.title,
      message:
        locale === "ru"
          ? notification.message === "A publication you follow has a new reply."
            ? "В публикации, на которую вы подписаны, появился новый ответ."
            : "В обсуждении, в котором вы участвуете, появился новый ответ."
          : notification.message,
    };
  const buildIncident = notification.data;
  if (buildIncident?.kind === "build_incident") {
    return {
      title:
        locale === "ru"
          ? "Уведомление безопасности о загруженной сборке"
          : "Security notice for a downloaded build",
      message:
        locale === "ru"
          ? "Сборка, которую вы загрузили, помещена в карантин после проверки безопасности. Прекратите использовать эту версию и проверьте наличие обновления в библиотеке."
          : "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
    };
  }
  const resourceQa = notification.data;
  if (resourceQa?.kind === "resource_qa") {
    const title = typeof resourceQa.productTitle === "string" ? resourceQa.productTitle.trim() : "";
    const named = title.length > 0 && title.length <= 200 ? title : null;
    const titles =
      locale === "ru"
        ? {
            asked: "Новый вопрос по ресурсу",
            answered: "Ответ на вопрос по ресурсу",
            resolved: "Вопрос по ресурсу решён",
            removed: "Вопрос по ресурсу удалён",
          }
        : {
            asked: "New resource question",
            answered: "Resource question answered",
            resolved: "Resource question resolved",
            removed: "Resource question removed",
          };
    const messages =
      locale === "ru"
        ? {
            asked: named
              ? `По ресурсу «${named}» задали новый публичный вопрос.`
              : "По ресурсу задали новый публичный вопрос.",
            answered: named
              ? `В ветке вопроса по «${named}» появился новый ответ.`
              : "В ветке вопроса появился новый ответ.",
            resolved: named
              ? `Ответ отмечен полезным для вопроса по «${named}».`
              : "Ответ отмечен полезным для этого вопроса.",
            removed: named
              ? `Вопрос по «${named}» удалён издателем или сотрудниками.`
              : "Вопрос удалён издателем или сотрудниками.",
          }
        : {
            asked: named
              ? `Someone asked a public question about ${named}.`
              : "Someone asked a public question about a resource.",
            answered: named
              ? `There is a new answer on a question about ${named}.`
              : "There is a new answer on a resource question thread.",
            resolved: named
              ? `A useful answer was marked for a question about ${named}.`
              : "A useful answer was marked for a resource question.",
            removed: named
              ? `A question about ${named} was removed by staff or the publisher.`
              : "A resource question was removed by staff or the publisher.",
          };
    return { title: titles[resourceQa.event], message: messages[resourceQa.event] };
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
  if (data?.kind === "build_lifecycle") {
    const title =
      typeof data.resourceTitle === "string" && data.resourceTitle.trim().length > 0
        ? data.resourceTitle.trim().slice(0, 200)
        : null;
    const version =
      typeof data.version === "string" && data.version.trim().length > 0
        ? data.version.trim().slice(0, 64)
        : null;
    if (data.event === "quarantined") {
      return {
        title: locale === "ru" ? "Сборка ресурса в карантине" : "Resource build quarantined",
        message:
          locale === "ru"
            ? title && version
              ? `«${title}» · версия ${version} помещена в карантин после проверки безопасности. Откройте сборку в рабочей области.`
              : "Опубликованная сборка помещена в карантин после проверки безопасности. Откройте сборку в рабочей области."
            : title && version
              ? `${title} · version ${version} was quarantined after a security review. Open the build in your workspace.`
              : "A published build was quarantined after a security review. Open the build in your workspace for the current delivery state.",
      };
    }
    if (data.event === "restored") {
      return {
        title: locale === "ru" ? "Сборка ресурса восстановлена" : "Resource build restored",
        message:
          locale === "ru"
            ? title && version
              ? `«${title}» · версия ${version} возвращена к публикации. Откройте сборку в рабочей области.`
              : "Сборка из карантина возвращена к публикации. Откройте сборку в рабочей области."
            : title && version
              ? `${title} · version ${version} was restored to publication. Open the build in your workspace.`
              : "A quarantined build was restored to publication. Open the build in your workspace for the current delivery state.",
      };
    }
  }
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
