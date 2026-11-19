/**
 * Static stored notification bodies may be bilingual `EN / RU` for Web Push OS
 * surfaces. Inbox remapping uses the English segment via `canonicalNoticeTitle`
 * (same slash rule) in notification-copy.
 */
export const noticeStoredMessages = {
  newSupportCase: "A support case is awaiting review. / Обращение ожидает рассмотрения.",
  supportCaseUpdated:
    "A support case has a new requester message. / Пользователь добавил сообщение в обращение.",
  serverOwnershipProofReview:
    "A verified server control proof is awaiting review. / Проверенное доказательство контроля сервера ожидает рассмотрения.",
  newVerificationRequest:
    "A verification request is awaiting review. / Заявка на верификацию ожидает рассмотрения.",
  passwordResetCompleted:
    "Your password was reset and all existing sessions were signed out. / Пароль сброшен, все существующие сессии завершены.",
  newCommunityReport:
    "A community report is awaiting review. / Жалоба сообщества ожидает рассмотрения.",
  newReport: "A report is awaiting review. / Жалоба ожидает рассмотрения.",
  discussionReplyFollowed:
    "A publication you follow has a new reply. / В публикации, на которую вы подписаны, появился новый ответ.",
  discussionReplyParticipating:
    "A discussion you participate in has a new reply. / В обсуждении, в котором вы участвуете, появился новый ответ.",
  securityDownloadedBuild:
    "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library. / Сборка, которую вы загрузили, помещена в карантин после проверки безопасности. Прекратите использовать эту версию и проверьте наличие обновления в библиотеке.",
} as const;
