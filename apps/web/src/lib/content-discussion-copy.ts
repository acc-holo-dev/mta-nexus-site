import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";

const en = {
  reloadSaved: "Reload saved comment",
  search: "Search comments or authors",
  applySearch: "Search",
  noMatches: "No matching comments.",
  noMatchesDescription: "Clear the search to see the full discussion again.",
  clearSearch: "Clear search",
  focusMissing:
    "This comment link is unavailable. The publication may still be open — return to the full discussion.",
  returnDiscussion: "Return to discussion",
  permalink: "Link to comment",
  focused: "Selected comment",
  edit: "Edit",
  remove: "Delete comment",
  moderateRemove: "Remove as moderator",
  confirmRemove: "Confirm deletion",
  confirmModerateRemove: "Confirm moderation removal",
  removeNote: "Your comment will be deleted. Replies will remain and keep their links.",
  moderateRemoveNote:
    "Moderator removal deletes this comment with a recorded reason. Replies remain. Moderators cannot rewrite another author's text.",
  saveEdit: "Save changes",
  cancelEdit: "Cancel",
  edited: "Comment updated.",
  removed: "Comment deleted.",
  moderatedRemoved: "Comment removed by moderation.",
  changed:
    "This comment changed on the server. Your local draft is kept below — compare or copy it before reloading.",
  draftKept: "Local draft kept. Copy it if you need the text after reload.",
  copyDraft: "Copy local draft",
  draftCopied: "Local draft copied.",
  reason: "Moderation reason",
  reasonRequired: "Provide a moderation reason.",
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
  unavailableDescription:
    "A load failure is not an empty discussion. Retry to fetch the latest comments for this publication.",
  retry: "Try again",
  first: "Start the discussion with a comment.",
  firstDescription:
    "Comments stay with this publication. Share a useful reply when you are ready — an empty thread is not a load failure.",
  anonymous: "Community member",
  parent: "In reply to",
  missingParent: "Comment no longer available",
  saved: "Comment published.",
  publishing: "Publishing…",
  publish: "Publish comment",
  publishRestoredDraft: "Publish restored comment",
  publishingRestoredDraft: "Publishing restored comment…",
  placeholder: "Share your thoughts or ask a question…",
  label: "Your comment",
  invalid: "Write 2–5000 characters.",
  invalidParent: "The comment you are replying to is no longer available.",
  invalidCursor: "This comment page is invalid. Reload the discussion.",
  signIn: "Sign in to join the discussion",
  latest: "Show latest comments",
  searchKeepsDraft: "Search does not clear your draft comment.",
  formErrorHint: "The comment action was not saved. Reload the saved comment before trying again.",
};
const ru: Record<keyof typeof en, string> = {
  reloadSaved: "Загрузить сохранённый комментарий",
  search: "Поиск по комментариям и авторам",
  applySearch: "Найти",
  noMatches: "Подходящих комментариев нет.",
  noMatchesDescription: "Очистите поиск, чтобы снова увидеть полное обсуждение.",
  clearSearch: "Очистить поиск",
  focusMissing:
    "Ссылка на комментарий недоступна. Публикация может быть открыта — вернитесь к общему обсуждению.",
  returnDiscussion: "Вернуться к обсуждению",
  permalink: "Ссылка на комментарий",
  focused: "Выбранный комментарий",
  edit: "Редактировать",
  remove: "Удалить комментарий",
  moderateRemove: "Удалить как модератор",
  confirmRemove: "Подтвердить удаление",
  confirmModerateRemove: "Подтвердить модераторское удаление",
  removeNote: "Ваш комментарий будет удалён. Ответы и их ссылки сохранятся.",
  moderateRemoveNote:
    "Модераторское удаление снимает комментарий с указанием причины. Ответы сохраняются. Модератор не может переписать чужой текст.",
  saveEdit: "Сохранить изменения",
  cancelEdit: "Отмена",
  edited: "Комментарий обновлён.",
  removed: "Комментарий удалён.",
  moderatedRemoved: "Комментарий удалён модерацией.",
  changed:
    "Комментарий изменился на сервере. Локальный черновик сохранён ниже — сравните или скопируйте его перед перезагрузкой.",
  draftKept: "Локальный черновик сохранён. Скопируйте текст, если он нужен после перезагрузки.",
  copyDraft: "Скопировать локальный черновик",
  draftCopied: "Локальный черновик скопирован.",
  reason: "Причина модерации",
  reasonRequired: "Укажите причину модерации.",
  invalidCommand:
    "Некорректное действие с комментарием. Перезагрузите обсуждение и повторите попытку.",
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
  unavailableDescription:
    "Ошибка загрузки — это не пустое обсуждение. Повторите запрос, чтобы получить актуальные комментарии к этой публикации.",
  retry: "Повторить",
  first: "Начните обсуждение первым комментарием.",
  firstDescription:
    "Комментарии остаются у этой публикации. Когда будете готовы, оставьте полезный ответ — пустая ветка не означает ошибку загрузки.",
  anonymous: "Участник сообщества",
  parent: "В ответ на",
  missingParent: "Комментарий больше недоступен",
  saved: "Комментарий опубликован.",
  publishing: "Публикация…",
  publish: "Опубликовать комментарий",
  publishRestoredDraft: "Опубликовать восстановленный комментарий",
  publishingRestoredDraft: "Публикация восстановленного комментария…",
  placeholder: "Поделитесь мнением или задайте вопрос…",
  label: "Ваш комментарий",
  invalid: "Напишите от 2 до 5000 символов.",
  invalidParent: "Комментарий, на который вы отвечаете, больше недоступен.",
  invalidCursor: "Некорректная страница комментариев. Перезагрузите обсуждение.",
  signIn: "Войдите, чтобы участвовать в обсуждении",
  latest: "Показать новые комментарии",
  searchKeepsDraft: "Поиск не очищает черновик комментария.",
  formErrorHint:
    "Действие с комментарием не сохранено. Загрузите сохранённый комментарий перед повторной попыткой.",
};
export const getDiscussionCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function discussionError(locale: Locale, code: unknown) {
  if (code === "DISCUSSION_UNAVAILABLE") return getDiscussionCopy(locale).changed;
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
  if (code === "INTERNAL_ERROR" || code === "UNCONFIRMED")
    return getDiscussionCopy(locale).writeUnavailable;
  return discussionError(locale, code);
}
export function discussionWriteNeedsSignIn(code: unknown): boolean {
  return code === "UNAUTHORIZED";
}
