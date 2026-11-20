/**
 * Stored notification bodies may be bilingual `EN / RU` for Web Push OS surfaces.
 * Inbox remapping uses the English segment via `canonicalNoticeTitle` (same slash
 * rule) in notification-copy. Helpers below keep dynamic fragments on both sides.
 */

export function bilingualNoticeMessage(en: string, ru: string) {
  return `${en} / ${ru}` as const;
}

export function withBilingualParenthetical(en: string, ru: string, detail: string) {
  const trimmed = detail.trim().slice(0, 200);
  if (!trimmed) return bilingualNoticeMessage(en, ru);
  return bilingualNoticeMessage(`${en} (${trimmed})`, `${ru} (${trimmed})`);
}

export const noticeStoredMessages = {
  newSupportCase: bilingualNoticeMessage(
    "A support case is awaiting review.",
    "Обращение ожидает рассмотрения.",
  ),
  supportCaseUpdated: bilingualNoticeMessage(
    "A support case has a new requester message.",
    "Пользователь добавил сообщение в обращение.",
  ),
  serverOwnershipProofReview: bilingualNoticeMessage(
    "A verified server control proof is awaiting review.",
    "Проверенное доказательство контроля сервера ожидает рассмотрения.",
  ),
  newVerificationRequest: bilingualNoticeMessage(
    "A verification request is awaiting review.",
    "Заявка на верификацию ожидает рассмотрения.",
  ),
  passwordResetCompleted: bilingualNoticeMessage(
    "Your password was reset and all existing sessions were signed out.",
    "Пароль сброшен, все существующие сессии завершены.",
  ),
  newCommunityReport: bilingualNoticeMessage(
    "A community report is awaiting review.",
    "Жалоба сообщества ожидает рассмотрения.",
  ),
  newReport: bilingualNoticeMessage("A report is awaiting review.", "Жалоба ожидает рассмотрения."),
  discussionReplyFollowed: bilingualNoticeMessage(
    "A publication you follow has a new reply.",
    "В публикации, на которую вы подписаны, появился новый ответ.",
  ),
  discussionReplyParticipating: bilingualNoticeMessage(
    "A discussion you participate in has a new reply.",
    "В обсуждении, в котором вы участвуете, появился новый ответ.",
  ),
  securityDownloadedBuild: bilingualNoticeMessage(
    "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
    "Сборка, которую вы загрузили, помещена в карантин после проверки безопасности. Прекратите использовать эту версию и проверьте наличие обновления в библиотеке.",
  ),
  publicationReaction: bilingualNoticeMessage(
    "A reader reacted to your publication.",
    "Читатель оставил реакцию на вашу публикацию.",
  ),
  discussionModerationRemoved: bilingualNoticeMessage(
    "Comment removed.",
    "Модератор удалил ваш комментарий. Откройте запись в рабочей области. Ответы сохранены.",
  ),
  resourceBuildQuarantined: bilingualNoticeMessage(
    "A published build was quarantined after a security review. Open the build in your workspace for the current delivery state.",
    "Опубликованная сборка помещена в карантин после проверки безопасности. Откройте сборку в рабочей области.",
  ),
  resourceBuildRestored: bilingualNoticeMessage(
    "A quarantined build was restored to publication. Open the build in your workspace for the current delivery state.",
    "Сборка из карантина возвращена к публикации. Откройте сборку в рабочей области.",
  ),
  supportActivity: {
    reply: bilingualNoticeMessage(
      "Support replied to your case.",
      "Поддержка ответила на ваше обращение.",
    ),
    open: bilingualNoticeMessage("Your case was reopened.", "Обращение переоткрыто."),
    resolved: bilingualNoticeMessage(
      "Your case was marked as resolved.",
      "Обращение отмечено решённым.",
    ),
    closed: bilingualNoticeMessage("Support closed your case.", "Обращение закрыто поддержкой."),
  },
  organizationAccess: {
    added: bilingualNoticeMessage("You were added to the team.", "Вас добавили в команду."),
    updated: bilingualNoticeMessage(
      "Your role or delegated access changed.",
      "Ваша роль или делегированный доступ изменены.",
    ),
    removed: bilingualNoticeMessage(
      "Your team access was revoked.",
      "Ваш доступ к команде отозван.",
    ),
    left: bilingualNoticeMessage("You left the team.", "Вы вышли из команды."),
    ownership_gained: bilingualNoticeMessage(
      "Organization ownership was transferred to you.",
      "Вам передано владение организацией.",
    ),
    ownership_transferred: bilingualNoticeMessage(
      "You transferred organization ownership.",
      "Вы передали владение организацией.",
    ),
  },
  publicationActivity: {
    created: bilingualNoticeMessage(
      "A publication was created in your context.",
      "Создана публикация в вашем контексте.",
    ),
    edited: bilingualNoticeMessage(
      "The publication changed. Editorial content returned to moderation.",
      "Публикация изменена. Статьи и новости возвращены на модерацию.",
    ),
    published: bilingualNoticeMessage(
      "A moderator published the material.",
      "Модератор опубликовал материал.",
    ),
    archived: bilingualNoticeMessage(
      "The publication was archived.",
      "Публикация перенесена в архив.",
    ),
    restored: bilingualNoticeMessage(
      "The publication was restored to a draft and remains private.",
      "Публикация восстановлена в черновик и остаётся непубличной.",
    ),
  },
  reportStatuses: {
    under_review: bilingualNoticeMessage("Report status: under_review.", "Жалоба рассматривается."),
    resolved: bilingualNoticeMessage("Report status: resolved.", "Жалоба решена."),
    dismissed: bilingualNoticeMessage("Report status: dismissed.", "Жалоба отклонена."),
  },
  serverOwnershipApproved: bilingualNoticeMessage(
    "Server ownership verification was approved.",
    "Подтверждение контроля сервера одобрено.",
  ),
  serverOwnershipRejected: bilingualNoticeMessage(
    "Server ownership verification was rejected.",
    "Подтверждение контроля сервера отклонено.",
  ),
} as const;

export function newFollowerNoticeMessage(handle: string) {
  return bilingualNoticeMessage(
    `@${handle} started following your activity.`,
    `@${handle} подписался на вашу активность.`,
  );
}

export function discussionModerationRemovedMessage(commentId: string) {
  return bilingualNoticeMessage(
    `Comment ${commentId}: removed.`,
    "Модератор удалил ваш комментарий. Откройте запись в рабочей области. Ответы сохранены.",
  );
}

export function publicationReactionNoticeMessage(title: string) {
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return noticeStoredMessages.publicationReaction;
  return withBilingualParenthetical(
    "A reader reacted to your publication.",
    "Читатель оставил реакцию на вашу публикацию.",
    trimmed,
  );
}

export function resourceQaNoticeMessage(
  kind: "asked" | "answered" | "resolved" | "removed",
  productTitle: string,
) {
  switch (kind) {
    case "asked":
      return bilingualNoticeMessage(
        `Someone asked about ${productTitle}.`,
        `По ресурсу «${productTitle}» задали новый публичный вопрос.`,
      );
    case "answered":
      return bilingualNoticeMessage(
        `There is a new answer for a question on ${productTitle}.`,
        `В ветке вопроса по «${productTitle}» появился новый ответ.`,
      );
    case "resolved":
      return bilingualNoticeMessage(
        `A useful answer was marked for a question on ${productTitle}.`,
        `Ответ отмечен полезным для вопроса по «${productTitle}».`,
      );
    case "removed":
      return bilingualNoticeMessage(
        `A question on ${productTitle} was removed by staff or the publisher.`,
        `Вопрос по «${productTitle}» удалён издателем или сотрудниками.`,
      );
  }
}

export function verificationResolutionNoticeMessage(input: {
  approved: boolean;
  serverResolution: boolean;
  targetType: string;
  targetId: string;
}) {
  const decision = input.approved ? "approved" : "rejected";
  const decisionRu = input.approved ? "одобрено" : "отклонено";
  if (input.serverResolution) {
    return input.approved
      ? noticeStoredMessages.serverOwnershipApproved
      : noticeStoredMessages.serverOwnershipRejected;
  }
  return bilingualNoticeMessage(
    `${input.targetType} verification for ${input.targetId} was ${decision}.`,
    `Подтверждение ${input.targetType} для ${input.targetId}: ${decisionRu}.`,
  );
}

/** Web Push body for finite license term notices; inbox remaps via `data.kind`. */
export function licenseTermUtcNoticeMessage(expiresAtIso: string) {
  const iso = expiresAtIso.trim();
  return bilingualNoticeMessage(`UTC: ${iso}`, `UTC: ${iso}`);
}

/** Web Push body for resource release watches; inbox remaps via `data.kind`. */
export function resourceReleaseNoticeMessage(resourceTitle: string, version: string) {
  const title = resourceTitle.trim().slice(0, 200);
  const ver = version.trim().slice(0, 64);
  const line = `${title} · ${ver}`;
  return bilingualNoticeMessage(line, line);
}

/** Web Push body for server publication fanout; inbox keeps the English segment. */
export function serverPublicationNoticeMessage(serverName: string, publicationTitle: string) {
  const server = serverName.trim().slice(0, 200);
  const title = publicationTitle.trim().slice(0, 200);
  const line = `${server}: ${title}`;
  return bilingualNoticeMessage(line, line);
}
