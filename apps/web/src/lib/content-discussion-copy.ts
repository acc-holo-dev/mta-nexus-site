import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";
const en = {
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
  missingParent: "Earlier comment",
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
  missingParent: "Предыдущий комментарий",
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
  if (code === "COMMENT_PARENT_NOT_FOUND" || code === "COMMENT_PARENT_TARGET_INVALID")
    return getDiscussionCopy(locale).invalidParent;
  if (code === "INVALID_CURSOR") return getDiscussionCopy(locale).invalidCursor;
  if (code === "VALIDATION_ERROR") return getDiscussionCopy(locale).invalid;
  return userPlatformError(locale, code);
}
