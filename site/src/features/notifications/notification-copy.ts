import type { Notification } from "@nexus/domain";
import type { Locale } from "../../lib/i18n";
import { licenseTermNotification } from "../commerce/license-maintenance-i18n";
import { resourceReleaseNotification } from "../resources/resource-release-watches-i18n";

const noticeCopy = {
  en: {
    discussionModeration: {
      title: "Discussion moderation",
      message:
        "A moderator removed your comment. Open the discussion in your workspace. Replies remain.",
    },
    publicationReaction: {
      title: "Publication reaction",
      message: "A reader reacted to your publication.",
    },
    publicationActivity: {
      title: "Publication activity",
      events: {
        created: "A publication was created in your context.",
        edited: "The publication changed. Editorial content returned to moderation.",
        published: "A moderator published the material.",
        archived: "The publication was archived.",
        restored: "The publication was restored to a draft and remains private.",
      },
    },
    supportActivity: {
      title: "Support case activity",
      events: {
        reply: "Support replied to your case.",
        open: "Your case was reopened.",
        resolved: "Your case was marked as resolved.",
        closed: "Support closed your case.",
      },
    },
    newSupportCase: {
      title: "New support case",
      message: "A support case is awaiting review.",
    },
    supportCaseUpdated: {
      title: "New support case message",
      message: "A requester added a message to the case.",
    },
    organizationAccess: {
      title: "Organization access changed",
      events: {
        added: "You were added to the team.",
        updated: "Your role or delegated access changed.",
        removed: "Your team access was revoked.",
        left: "You left the team.",
        ownership_gained: "Organization ownership was transferred to you.",
        ownership_transferred: "You transferred organization ownership.",
      },
    },
    verificationApproved: "Verification approved",
    verificationRejected: "Verification rejected",
    serverOwnershipApproved: "Server ownership verification was approved.",
    serverOwnershipRejected: "Server ownership verification was rejected.",
    verificationKinds: {
      user: "Identity verification",
      developer: "Developer experience verification",
      organization: "Organization verification",
      server: "Server ownership verification",
    },
    verificationApprovedMessage: (kind: string) =>
      `${kind} was approved. Open the application in your workspace.`,
    verificationRejectedMessage: (kind: string) =>
      `${kind} was rejected. Open the application in your workspace.`,
    serverProofReview: {
      title: "Server ownership proof requires review",
      message: "A verified server control proof is awaiting review.",
    },
    newVerificationRequest: {
      title: "New verification request",
      kinds: {
        user: "identity",
        developer: "developer experience",
        organization: "organization",
        server: "server control",
      },
      message: (kind: string, id: string) => `${kind} verification requested for ${id}`,
    },
    newCommunityReport: {
      title: "New community report",
      message: "A community report is awaiting review.",
    },
    newReport: {
      title: "New report",
      message: "A report is awaiting review.",
    },
    communityReportStatus: "Community report status",
    platformReportStatus: "Platform report status",
    reportStatuses: {
      under_review: "Report status: under_review.",
      resolved: "Report status: resolved.",
      dismissed: "Report status: dismissed.",
    },
    discussionReply: {
      title: "New discussion reply",
      followed: "A publication you follow has a new reply.",
      participating: "A discussion you participate in has a new reply.",
    },
    buildIncident: {
      title: "Security notice for a downloaded build",
      message:
        "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
    },
    resourceQa: {
      titles: {
        asked: "New resource question",
        answered: "Resource question answered",
        resolved: "Resource question resolved",
        removed: "Resource question removed",
      },
      messages: {
        asked: (named: string | null) =>
          named
            ? `Someone asked a public question about ${named}.`
            : "Someone asked a public question about a resource.",
        answered: (named: string | null) =>
          named
            ? `There is a new answer on a question about ${named}.`
            : "There is a new answer on a resource question thread.",
        resolved: (named: string | null) =>
          named
            ? `A useful answer was marked for a question about ${named}.`
            : "A useful answer was marked for a resource question.",
        removed: (named: string | null) =>
          named
            ? `A question about ${named} was removed by staff or the publisher.`
            : "A resource question was removed by staff or the publisher.",
      },
    },
    newFollower: {
      title: "New follower",
      message: (handle: string) => `@${handle} started following your activity.`,
    },
    newComment: {
      title: "New comment",
      message: (handle: string, title: string) => `@${handle} commented on “${title}”.`,
    },
    buildLifecycle: {
      quarantined: {
        title: "Resource build quarantined",
        named: (title: string, version: string) =>
          `${title} · version ${version} was quarantined after a security review. Open the build in your workspace.`,
        plain:
          "A published build was quarantined after a security review. Open the build in your workspace for the current delivery state.",
      },
      restored: {
        title: "Resource build restored",
        named: (title: string, version: string) =>
          `${title} · version ${version} was restored to publication. Open the build in your workspace.`,
        plain:
          "A quarantined build was restored to publication. Open the build in your workspace for the current delivery state.",
      },
    },
  },
  ru: {
    discussionModeration: {
      title: "Модерация обсуждения",
      message:
        "Модератор удалил ваш комментарий. Откройте запись в рабочей области. Ответы сохранены.",
    },
    publicationReaction: {
      title: "Реакция на публикацию",
      message: "Читатель оставил реакцию на вашу публикацию.",
    },
    publicationActivity: {
      title: "Обновление публикации",
      events: {
        created: "Создана публикация в вашем контексте.",
        edited: "Публикация изменена. Статьи и новости возвращены на модерацию.",
        published: "Модератор опубликовал материал.",
        archived: "Публикация перенесена в архив.",
        restored: "Публикация восстановлена в черновик и остаётся непубличной.",
      },
    },
    supportActivity: {
      title: "Обновление обращения",
      events: {
        reply: "Поддержка ответила на ваше обращение.",
        open: "Обращение переоткрыто.",
        resolved: "Обращение отмечено решённым.",
        closed: "Обращение закрыто поддержкой.",
      },
    },
    newSupportCase: {
      title: "Новое обращение",
      message: "Обращение ожидает рассмотрения.",
    },
    supportCaseUpdated: {
      title: "Новое сообщение в обращении",
      message: "Пользователь добавил сообщение в обращение.",
    },
    organizationAccess: {
      title: "Доступ к организации изменён",
      events: {
        added: "Вас добавили в команду.",
        updated: "Ваша роль или делегированный доступ изменены.",
        removed: "Ваш доступ к команде отозван.",
        left: "Вы вышли из команды.",
        ownership_gained: "Вам передано владение организацией.",
        ownership_transferred: "Вы передали владение организацией.",
      },
    },
    verificationApproved: "Верификация одобрена",
    verificationRejected: "Верификация отклонена",
    serverOwnershipApproved: "Подтверждение контроля сервера одобрено.",
    serverOwnershipRejected: "Подтверждение контроля сервера отклонено.",
    verificationKinds: {
      user: "Подтверждение личности",
      developer: "Подтверждение опыта разработчика",
      organization: "Подтверждение организации",
      server: "Подтверждение контроля сервера",
    },
    verificationApprovedMessage: (kind: string) =>
      `${kind} одобрено. Откройте заявку в рабочей области.`,
    verificationRejectedMessage: (kind: string) =>
      `${kind} отклонено. Откройте заявку в рабочей области.`,
    serverProofReview: {
      title: "Доказательство контроля сервера требует проверки",
      message: "Проверенное доказательство контроля сервера ожидает рассмотрения.",
    },
    newVerificationRequest: {
      title: "Новая заявка на верификацию",
      kinds: {
        user: "личности",
        developer: "опыта разработчика",
        organization: "организации",
        server: "контроля сервера",
      },
      message: (kind: string, id: string) => `Подтверждение ${kind}: ${id}.`,
    },
    newCommunityReport: {
      title: "Новая жалоба сообщества",
      message: "Жалоба сообщества ожидает рассмотрения.",
    },
    newReport: {
      title: "Новая жалоба",
      message: "Жалоба ожидает рассмотрения.",
    },
    communityReportStatus: "Статус жалобы",
    platformReportStatus: "Статус жалобы платформы",
    reportStatuses: {
      under_review: "Жалоба рассматривается.",
      resolved: "Жалоба решена.",
      dismissed: "Жалоба отклонена.",
    },
    discussionReply: {
      title: "Новый ответ в обсуждении",
      followed: "В публикации, на которую вы подписаны, появился новый ответ.",
      participating: "В обсуждении, в котором вы участвуете, появился новый ответ.",
    },
    buildIncident: {
      title: "Уведомление безопасности о загруженной сборке",
      message:
        "Сборка, которую вы загрузили, помещена в карантин после проверки безопасности. Прекратите использовать эту версию и проверьте наличие обновления в библиотеке.",
    },
    resourceQa: {
      titles: {
        asked: "Новый вопрос по ресурсу",
        answered: "Ответ на вопрос по ресурсу",
        resolved: "Вопрос по ресурсу решён",
        removed: "Вопрос по ресурсу удалён",
      },
      messages: {
        asked: (named: string | null) =>
          named
            ? `По ресурсу «${named}» задали новый публичный вопрос.`
            : "По ресурсу задали новый публичный вопрос.",
        answered: (named: string | null) =>
          named
            ? `В ветке вопроса по «${named}» появился новый ответ.`
            : "В ветке вопроса появился новый ответ.",
        resolved: (named: string | null) =>
          named
            ? `Ответ отмечен полезным для вопроса по «${named}».`
            : "Ответ отмечен полезным для этого вопроса.",
        removed: (named: string | null) =>
          named
            ? `Вопрос по «${named}» удалён издателем или сотрудниками.`
            : "Вопрос удалён издателем или сотрудниками.",
      },
    },
    newFollower: {
      title: "Новый подписчик",
      message: (handle: string) => `@${handle} подписался на вашу активность.`,
    },
    newComment: {
      title: "Новый комментарий",
      message: (handle: string, title: string) => `@${handle} оставил комментарий к «${title}».`,
    },
    buildLifecycle: {
      quarantined: {
        title: "Сборка ресурса в карантине",
        named: (title: string, version: string) =>
          `«${title}» · версия ${version} помещена в карантин после проверки безопасности. Откройте сборку в рабочей области.`,
        plain:
          "Опубликованная сборка помещена в карантин после проверки безопасности. Откройте сборку в рабочей области.",
      },
      restored: {
        title: "Сборка ресурса восстановлена",
        named: (title: string, version: string) =>
          `«${title}» · версия ${version} возвращена к публикации. Откройте сборку в рабочей области.`,
        plain: "Сборка из карантина возвращена к публикации. Откройте сборку в рабочей области.",
      },
    },
  },
} as const;

function noticeLocale(locale: Locale): "ru" | "en" {
  return locale === "ru" ? "ru" : "en";
}

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
  const c = noticeCopy[noticeLocale(locale)];
  if (
    notification.title === "Discussion moderation" &&
    /^Comment ([a-zA-Z0-9_-]{1,128}): removed\.$/u.test(notification.message)
  )
    return { title: c.discussionModeration.title, message: c.discussionModeration.message };
  const publicationActivityMessages = (event: string): string | undefined => {
    const events = c.publicationActivity.events;
    return Object.hasOwn(events, event) ? events[event as keyof typeof events] : undefined;
  };
  const withContentTitle = (message: string, title: unknown) => {
    const trimmed = typeof title === "string" ? title.trim().slice(0, 200) : "";
    return trimmed ? `${message} (${trimmed})` : message;
  };
  if (notification.data?.kind === "content_reaction") {
    return {
      title: c.publicationReaction.title,
      message: withContentTitle(c.publicationReaction.message, notification.data.contentTitle),
    };
  }
  if (notification.data?.kind === "publication_activity") {
    const base = publicationActivityMessages(notification.data.event);
    if (base) {
      return {
        title: c.publicationActivity.title,
        message: withContentTitle(base, notification.data.contentTitle),
      };
    }
  }
  if (
    notification.title === "Publication reaction" &&
    /^Publication ([a-zA-Z0-9_-]{1,128}): reaction\.$/u.test(notification.message)
  )
    return { title: c.publicationReaction.title, message: c.publicationReaction.message };
  const publication =
    notification.title === "Publication activity" &&
    /^Publication ([a-zA-Z0-9_-]{1,128}): (created|edited|published|archived|restored)\.$/u.exec(
      notification.message,
    );
  if (publication) {
    const message = publicationActivityMessages(publication[2]);
    if (message) return { title: c.publicationActivity.title, message };
  }
  const supportActivityMessages = (event: string): string | undefined => {
    const events = c.supportActivity.events;
    return Object.hasOwn(events, event) ? events[event as keyof typeof events] : undefined;
  };
  if (notification.data?.kind === "support_requester") {
    const base = supportActivityMessages(notification.data.event);
    if (base) {
      const subject =
        typeof notification.data.subject === "string"
          ? notification.data.subject.trim().slice(0, 200)
          : "";
      return {
        title: c.supportActivity.title,
        message: subject ? `${base} (${subject})` : base,
      };
    }
  }
  const supportActivity =
    notification.title === "Support case activity" &&
    /^Support case (sup_[a-f0-9]{24}): (reply|open|resolved|closed)\.$/u.exec(notification.message);
  if (supportActivity) {
    const message = supportActivityMessages(supportActivity[2]);
    if (message) return { title: c.supportActivity.title, message };
  }
  if (
    notification.title === "New support case" &&
    notification.message === "A support case is awaiting review."
  )
    return { title: c.newSupportCase.title, message: c.newSupportCase.message };
  if (
    notification.title === "Support case updated" &&
    notification.message === "A support case has a new requester message."
  )
    return { title: c.supportCaseUpdated.title, message: c.supportCaseUpdated.message };
  const organizationAccessMessages = (event: string): string | undefined => {
    const events = c.organizationAccess.events;
    return Object.hasOwn(events, event) ? events[event as keyof typeof events] : undefined;
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
        title: c.organizationAccess.title,
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
    if (message) return { title: c.organizationAccess.title, message };
  }
  const serverOwnership = /^Server ownership verification was (approved|rejected)\.$/u.exec(
    notification.message,
  );
  if (
    serverOwnership &&
    (notification.title === "Verification approved" ||
      notification.title === "Verification rejected")
  ) {
    const approved = serverOwnership[1] === "approved";
    return {
      title: approved ? c.verificationApproved : c.verificationRejected,
      message: approved ? c.serverOwnershipApproved : c.serverOwnershipRejected,
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
    const kindKey = verification[1] as keyof typeof c.verificationKinds;
    const approved = verification[3] === "approved";
    const kindLabel = c.verificationKinds[kindKey];
    return {
      title: approved ? c.verificationApproved : c.verificationRejected,
      message: approved
        ? c.verificationApprovedMessage(kindLabel)
        : c.verificationRejectedMessage(kindLabel),
    };
  }
  if (
    notification.title === "Server ownership proof requires review" &&
    notification.message === "A verified server control proof is awaiting review."
  )
    return { title: c.serverProofReview.title, message: c.serverProofReview.message };
  const requested =
    /^(user|developer|organization|server) verification requested for ([a-zA-Z0-9_-]{1,128})$/u.exec(
      notification.message,
    );
  if (notification.title === "New verification request" && requested) {
    if (locale === "ru") {
      const kindKey = requested[1] as keyof typeof c.newVerificationRequest.kinds;
      return {
        title: c.newVerificationRequest.title,
        message: c.newVerificationRequest.message(
          c.newVerificationRequest.kinds[kindKey],
          requested[2],
        ),
      };
    }
    // English keeps the stored title/message for staff request notices.
  }
  if (
    notification.title === "New community report" &&
    notification.message === "A community report is awaiting review."
  )
    return { title: c.newCommunityReport.title, message: c.newCommunityReport.message };
  if (
    notification.title === "New report" &&
    notification.message === "A report is awaiting review."
  )
    return { title: c.newReport.title, message: c.newReport.message };
  const reportStatus =
    (notification.title === "Community report status" ||
      notification.title === "Platform report status") &&
    /^Report status: (under_review|resolved|dismissed)\.$/u.exec(notification.message);
  if (reportStatus) {
    const statusKey = reportStatus[1] as keyof typeof c.reportStatuses;
    return {
      title:
        notification.title === "Platform report status"
          ? c.platformReportStatus
          : c.communityReportStatus,
      message: c.reportStatuses[statusKey],
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
      title: c.discussionReply.title,
      message:
        notification.message === "A publication you follow has a new reply."
          ? c.discussionReply.followed
          : c.discussionReply.participating,
    };
  const buildIncident = notification.data;
  if (buildIncident?.kind === "build_incident") {
    return { title: c.buildIncident.title, message: c.buildIncident.message };
  }
  const resourceQa = notification.data;
  if (resourceQa?.kind === "resource_qa") {
    const title = typeof resourceQa.productTitle === "string" ? resourceQa.productTitle.trim() : "";
    const named = title.length > 0 && title.length <= 200 ? title : null;
    const event = resourceQa.event as keyof typeof c.resourceQa.titles;
    return {
      title: c.resourceQa.titles[event],
      message: c.resourceQa.messages[event](named),
    };
  }
  const follower =
    notification.title === "New Follower" &&
    /^@([a-zA-Z0-9_-]{1,80}) started following your activity\.$/u.exec(notification.message);
  if (follower)
    return {
      title: c.newFollower.title,
      message: c.newFollower.message(follower[1]),
    };
  // These notices predate structured review payloads; localize their bounded,
  // server-generated template without changing persisted notification contracts.
  const comment =
    notification.title === "New article comment" &&
    /^@([a-zA-Z0-9_-]{1,80}) commented on “([\s\S]{1,200})”\.$/u.exec(notification.message);
  if (comment)
    return {
      title: c.newComment.title,
      message: c.newComment.message(comment[1], comment[2]),
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
        title: c.buildLifecycle.quarantined.title,
        message:
          title && version
            ? c.buildLifecycle.quarantined.named(title, version)
            : c.buildLifecycle.quarantined.plain,
      };
    }
    if (data.event === "restored") {
      return {
        title: c.buildLifecycle.restored.title,
        message:
          title && version
            ? c.buildLifecycle.restored.named(title, version)
            : c.buildLifecycle.restored.plain,
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
