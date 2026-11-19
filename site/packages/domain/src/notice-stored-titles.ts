/**
 * Stored notification titles may be bilingual `EN / RU` for Web Push OS surfaces
 * that show the raw title. Inbox remapping uses the English segment via
 * `canonicalNoticeTitle` in notification-copy.
 */
export const noticeStoredTitles = {
  discussionModeration: "Discussion moderation / Модерация обсуждения",
  publicationReaction: "Publication reaction / Реакция на публикацию",
  publicationActivity: "Publication activity / Обновление публикации",
  supportCaseActivity: "Support case activity / Обновление обращения",
  newSupportCase: "New support case / Новое обращение",
  supportCaseUpdated: "Support case updated / Новое сообщение в обращении",
  organizationAccessChanged: "Organization access changed / Доступ к организации изменён",
  verificationApproved: "Verification approved / Верификация одобрена",
  verificationRejected: "Verification rejected / Верификация отклонена",
  serverOwnershipProofReview:
    "Server ownership proof requires review / Доказательство контроля сервера требует проверки",
  newVerificationRequest: "New verification request / Новая заявка на верификацию",
  newServerUpdate: "New server update / Новость сервера",
  passwordResetCompleted: "Password reset completed / Пароль восстановлен",
  newCommunityReport: "New community report / Новая жалоба сообщества",
  newReport: "New report / Новая жалоба",
  communityReportStatus: "Community report status / Статус жалобы",
  platformReportStatus: "Platform report status / Статус жалобы платформы",
  newDiscussionReply: "New discussion reply / Новый ответ в обсуждении",
  securityDownloadedBuild:
    "Security notice for a downloaded build / Уведомление безопасности о загруженной сборке",
  newResourceQuestion: "New resource question / Новый вопрос по ресурсу",
  resourceQuestionAnswered: "Resource question answered / Ответ на вопрос по ресурсу",
  resourceQuestionResolved: "Resource question resolved / Вопрос по ресурсу решён",
  resourceQuestionRemoved: "Resource question removed / Вопрос по ресурсу удалён",
  newFollower: "New Follower / Новый подписчик",
  resourceBuildQuarantined: "Resource build quarantined / Сборка ресурса в карантине",
  resourceBuildRestored: "Resource build restored / Сборка ресурса восстановлена",
} as const;
