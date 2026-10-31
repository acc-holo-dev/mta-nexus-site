import type { Locale } from "./i18n";

const en = {
  title: "Server reviews",
  description:
    "Reviews require a verified follow of this public server. Star ratings are one signal among others — not the server’s sole trust score.",
  empty: "No verified-interaction reviews yet.",
  write: "Write or manage my review",
  access:
    "Follow this public server to leave a verified-interaction review. Operators cannot review their own server.",
  followRequired: "Follow this server before publishing a review.",
  ownerConflict: "Server operators cannot review their own server.",
  moderated: "This review was removed by moderation and cannot be republished.",
  interaction: "Verified server interaction",
  follow: "Follow evidence checked",
  rating: "Rating",
  text: "Your review",
  save: "Publish review",
  withdraw: "Withdraw review",
  busy: "Saving…",
  saved: "Saved",
  published: "Published",
  withdrawn: "Withdrawn",
  removed: "Removed by moderation",
  reason: "Reason",
  signIn: "Sign in to review",
  reload: "Reload saved state",
  unknown: "The result could not be confirmed. Reload before continuing.",
  denied: "You no longer have verified interaction access.",
  invalid: "Check the rating and text length.",
  limited: "Too many requests. Try again later.",
  missing: "The server or review is unavailable.",
  changed: "The review changed. Reload before trying again.",
  author: "Author",
  all: "Verified reviews",
  openTrust: "Server trust",
};

const ru: typeof en = {
  title: "Отзывы о сервере",
  description:
    "Отзывы требуют подтверждённой подписки (follow) на этот публичный сервер. Оценка — один из сигналов, а не единственный рейтинг доверия.",
  empty: "Пока нет отзывов с подтверждённым взаимодействием.",
  write: "Написать или изменить мой отзыв",
  access:
    "Подпишитесь на этот публичный сервер, чтобы оставить отзыв с подтверждённым взаимодействием. Операторы не могут оценивать свой сервер.",
  followRequired: "Сначала подпишитесь на сервер, затем публикуйте отзыв.",
  ownerConflict: "Операторы сервера не могут оставлять отзыв о своём сервере.",
  moderated: "Отзыв удалён модерацией и не может быть опубликован снова.",
  interaction: "Подтверждённое взаимодействие с сервером",
  follow: "Подписка (follow) проверена",
  rating: "Оценка",
  text: "Ваш отзыв",
  save: "Опубликовать отзыв",
  withdraw: "Отозвать отзыв",
  busy: "Сохранение…",
  saved: "Сохранено",
  published: "Опубликован",
  withdrawn: "Отозван",
  removed: "Удалён модерацией",
  reason: "Причина",
  signIn: "Войдите, чтобы оставить отзыв",
  reload: "Обновить сохранённое состояние",
  unknown: "Результат не подтверждён. Обновите состояние перед продолжением.",
  denied: "Подтверждённое взаимодействие больше недоступно.",
  invalid: "Проверьте оценку и длину текста.",
  limited: "Слишком много запросов. Попробуйте позже.",
  missing: "Сервер или отзыв недоступен.",
  changed: "Отзыв изменился. Обновите страницу и попробуйте снова.",
  author: "Автор",
  all: "Проверенные отзывы",
  openTrust: "Доверие к серверу",
};

export function serverReviewCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}

export function serverReviewState(locale: Locale, status: "published" | "withdrawn" | "removed") {
  return serverReviewCopy(locale)[status];
}

export function serverReviewError(locale: Locale, code?: string) {
  const copy = serverReviewCopy(locale);
  if (code === "REVIEW_ACCESS_REQUIRED") return copy.denied;
  if (code === "REVIEW_CHANGED") return copy.changed;
  if (code === "REVIEW_MODERATED") return copy.moderated;
  if (code === "REVIEW_INVALID") return copy.invalid;
  if (code === "NOT_FOUND") return copy.missing;
  if (code === "RATE_LIMIT_EXCEEDED") return copy.limited;
  return copy.unknown;
}
