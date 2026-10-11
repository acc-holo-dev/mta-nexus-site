import { moderationError } from "./community-moderation-copy";
import type { Locale } from "./i18n";

const en = {
  title: "Discussion moderation",
  description:
    "Review publication comments, including drafts and archived publications. Recorded reasons are visible to current moderators.",
  open: "Moderate discussion",
  review: "Review comment",
  empty: "No matching comments.",
  author: "Author",
  unknown: "Account unavailable",
  back: "Back to discussion",
  publication: "Review publication",
  body: "Comment text",
  parent: "Reply context",
  truncated:
    "This legacy comment exceeds the preview limit. Only the first 5,000 characters are shown; confirmation is bound to the complete saved text.",
  remove: "Remove comment",
  confirm:
    "Remove this reviewed comment? Replies will remain, and the recorded reason will be retained.",
  reason: "Reason for removal (3–1,000 characters)",
  saving: "Saving…",
  saved: "Comment removed. Reload to see the retained decision.",
  removed: "This comment has been removed. Retained decisions are shown below.",
  history: "Retained comment activity",
  historyHelp:
    "Retained edits and removals for this comment. Deleted comment text and private account data are not included.",
  emptyHistory: "No retained activity on this page.",
  edited: "Comment edited",
  deleted: "Comment removed",
  moderator: "Moderation action",
  owner: "Author action",
  changed: "The comment changed. Reload and review the current text before removing it.",
  unavailable:
    "The comment or publication is unavailable. Return to the discussion or reload current data.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Модерация обсуждения",
  description:
    "Проверяйте комментарии публикаций, включая черновики и архив. Записанные причины доступны действующим модераторам.",
  open: "Модерация обсуждения",
  review: "Проверить комментарий",
  empty: "Подходящих комментариев нет.",
  author: "Автор",
  unknown: "Аккаунт недоступен",
  back: "К обсуждению",
  publication: "Проверить публикацию",
  body: "Текст комментария",
  parent: "Контекст ответа",
  truncated:
    "Этот старый комментарий превышает лимит просмотра. Показаны первые 5 000 символов; подтверждение связано с полным сохранённым текстом.",
  remove: "Удалить комментарий",
  confirm:
    "Удалить проверенный комментарий? Ответы сохранятся, а записанная причина останется в истории.",
  reason: "Причина удаления (3–1 000 символов)",
  saving: "Сохранение…",
  saved: "Комментарий удалён. Загрузите страницу для просмотра записанного решения.",
  removed: "Этот комментарий удалён. Сохранённые решения показаны ниже.",
  history: "Сохранённая история комментария",
  historyHelp:
    "Сохранённые правки и удаления этого комментария. Текст удалённого комментария и закрытые данные аккаунтов не включены.",
  emptyHistory: "На этой странице нет сохранённых событий.",
  edited: "Комментарий изменён",
  deleted: "Комментарий удалён",
  moderator: "Действие модерации",
  owner: "Действие автора",
  changed: "Комментарий изменился. Загрузите и проверьте актуальный текст перед удалением.",
  unavailable:
    "Комментарий или публикация недоступны. Вернитесь к обсуждению или загрузите актуальные данные.",
};
export const moderatedDiscussionCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function moderatedDiscussionError(locale: Locale, code: unknown) {
  if (code === "COMMENT_CHANGED") return moderatedDiscussionCopy(locale).changed;
  if (code === "NOT_FOUND") return moderatedDiscussionCopy(locale).unavailable;
  return moderationError(locale, code);
}
