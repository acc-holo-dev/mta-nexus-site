import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
  search: "Search comments or authors", applySearch: "Search", noMatches: "No matching comments.", focusMissing: "This comment is unavailable. Open the latest discussion.", permalink: "Link to comment", focused: "Selected comment",
  edit: "Edit", remove: "Remove", confirmRemove: "Confirm removal", removeNote: "The comment will be removed. Replies will remain.",
  saveEdit: "Save changes", cancelEdit: "Cancel", edited: "Comment updated.", removed: "Comment removed.",
  changed: "This comment changed. Reload the discussion before editing or removing it.", reason: "Moderation reason", reasonRequired: "Provide a moderation reason.",
  invalidCommand: "Invalid comment action. Reload the discussion and try again.",
  writeUnavailable:
    "Could not confirm the comment. Check the latest discussion before trying again.",
  backCommunity: "Back to community",
  title: "Discussion",
  reply: "Reply",
  replying: "Replying to",
  cancel: "Cancel reply",
  older: "Load older comments",
  loading: "Loading comments…",
  unavailable: "Unable to load comments. Try again.",
  retry: "Try again",
  first: "Start the discussion with a comment.",
  anonymous: "Community member",
  parent: "In reply to",
  missingParent: "Comment no longer available",
  saved: "Comment published.",
  publishing: "Publishing…",
  publish: "Publish comment",
  placeholder: "Share your thoughts or ask a question…",
  label: "Your comment",
  invalid: "Write 2–5000 characters.",
  invalidParent: "The comment you are replying to is no longer available.",
  invalidCursor: "This comment page is invalid. Reload the discussion.",
  signIn: "Sign in to join the discussion",
  latest: "Show latest comments",
};
const ru: Record<keyof typeof en, string> = {
  search: "Поиск по комментариям и авторам", applySearch: "Найти", noMatches: "Подходящих комментариев нет.", focusMissing: "Этот комментарий недоступен. Откройте новые сообщения обсуждения.", permalink: "Ссылка на комментарий", focused: "Выбранный комментарий",
  edit: "Редактировать", remove: "Удалить", confirmRemove: "Подтвердить удаление", removeNote: "Комментарий будет удалён. Ответы сохранятся.",
  saveEdit: "Сохранить изменения", cancelEdit: "Отмена", edited: "Комментарий обновлён.", removed: "Комментарий удалён.",
  changed: "Комментарий изменился. Перезагрузите обсуждение перед редактированием или удалением.", reason: "Причина модерации", reasonRequired: "Укажите причину модерации.",
  invalidCommand: "Некорректное действие с комментарием. Перезагрузите обсуждение и повторите попытку.",
  writeUnavailable:
    "Не удалось подтвердить комментарий. Проверьте новые сообщения перед повторной отправкой.",
  backCommunity: "К сообществу",
  title: "Обсуждение",
  reply: "Ответить",
  replying: "Ответ для",
  cancel: "Отменить ответ",
  older: "Загрузить старые комментарии",
  loading: "Загрузка комментариев…",
  unavailable: "Не удалось загрузить комментарии. Попробуйте ещё раз.",
  retry: "Повторить",
  first: "Начните обсуждение первым комментарием.",
  anonymous: "Участник сообщества",
  parent: "В ответ на",
  missingParent: "Комментарий больше недоступен",
  saved: "Комментарий опубликован.",
  publishing: "Публикация…",
  publish: "Опубликовать комментарий",
  placeholder: "Поделитесь мнением или задайте вопрос…",
  label: "Ваш комментарий",
  invalid: "Напишите от 2 до 5000 символов.",
  invalidParent: "Комментарий, на который вы отвечаете, больше недоступен.",
  invalidCursor: "Некорректная страница комментариев. Перезагрузите обсуждение.",
  signIn: "Войдите, чтобы участвовать в обсуждении",
  latest: "Показать новые комментарии",
};
export const getDiscussionCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function discussionError(locale: Locale, code: unknown) {
  if (code === "COMMENT_FOCUS_NOT_FOUND") return getDiscussionCopy(locale).focusMissing;
  if (code === "COMMENT_COMMAND_INVALID") return getDiscussionCopy(locale).invalidCommand;
  if (code === "COMMENT_CHANGED") return getDiscussionCopy(locale).changed;
  if (code === "COMMENT_REASON_REQUIRED") return getDiscussionCopy(locale).reasonRequired;
  if (code === "COMMENT_PARENT_NOT_FOUND" || code === "COMMENT_PARENT_TARGET_INVALID")
    return getDiscussionCopy(locale).invalidParent;
  if (code === "INVALID_CURSOR") return getDiscussionCopy(locale).invalidCursor;
  if (code === "VALIDATION_ERROR") return getDiscussionCopy(locale).invalid;
  return userPlatformError(locale, code);
}
export function discussionMutationError(locale: Locale, code: unknown) {
  if (code === "INTERNAL_ERROR" || code === "UNCONFIRMED") return getDiscussionCopy(locale).writeUnavailable;
  return discussionError(locale, code);
}
