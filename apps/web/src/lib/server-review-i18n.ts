import type { Locale } from "./i18n";

const en = {
  title: "Server reviews",
  description:
    "Reviews require an active follow of this public server. Follow is not proof of gameplay. Star ratings are one signal among others — not the server’s sole trust score.",
  empty: "No follow-based reviews yet.",
  write: "Write or manage my review",
  access:
    "Follow this public server to leave a review. Follow confirms a saved interest, not that you joined or played. Operators cannot review their own server.",
  followRequired:
    "Follow this server before publishing a review. Eligibility refreshes after Follow.",
  ownerConflict: "Server operators and managers cannot review their own server.",
  moderated: "This review was removed by moderation and cannot be republished.",
  interaction: "Follow-based server review",
  follow: "Follow evidence checked (not verified play)",
  rating: "Rating",
  text: "Your review",
  save: "Publish review",
  withdraw: "Withdraw review",
  withdrawConfirmTitle: "Withdraw this review?",
  withdrawConfirm:
    "Your review will no longer appear publicly. You can publish a new review later if you still have follow access.",
  cancel: "Cancel",
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
  all: "Follow-based reviews",
  openTrust: "Server trust",
  loadUnavailable: "Reviews are temporarily unavailable. This does not mean there are no reviews.",
  loadRetry: "Retry loading reviews",
  reloadReason: "Your review is saved on the server. Reload to edit it again.",
};

const ru: typeof en = {
  title: "Отзывы о сервере",
  description:
    "Отзывы требуют активной подписки (follow) на этот публичный сервер. Follow не доказывает игру. Оценка — один из сигналов, а не единственный рейтинг доверия.",
  empty: "Пока нет отзывов на основании follow.",
  write: "Написать или изменить мой отзыв",
  access:
    "Подпишитесь на этот публичный сервер, чтобы оставить отзыв. Follow подтверждает сохранённый интерес, а не вход в игру. Операторы не могут оценивать свой сервер.",
  followRequired:
    "Сначала подпишитесь на сервер, затем публикуйте отзыв. После Follow eligibility обновляется.",
  ownerConflict: "Операторы и управляющие сервером не могут оставлять отзыв о своём сервере.",
  moderated: "Отзыв удалён модерацией и не может быть опубликован снова.",
  interaction: "Отзыв на основании follow",
  follow: "Подписка (follow) проверена (не подтверждённая игра)",
  rating: "Оценка",
  text: "Ваш отзыв",
  save: "Опубликовать отзыв",
  withdraw: "Отозвать отзыв",
  withdrawConfirmTitle: "Отозвать этот отзыв?",
  withdrawConfirm:
    "Отзыв перестанет отображаться публично. При сохранённом follow-доступе вы сможете опубликовать новый отзыв позже.",
  cancel: "Отмена",
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
  all: "Отзывы на основании follow",
  openTrust: "Доверие к серверу",
  loadUnavailable: "Отзывы временно недоступны. Это не означает, что отзывов нет.",
  loadRetry: "Повторить загрузку",
  reloadReason: "Состояние сохранено на сервере. Обновите страницу, чтобы снова изменить отзыв.",
};

export function serverReviewCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}

export function serverReviewLoadCopy(locale: Locale) {
  const copy = serverReviewCopy(locale);
  return {
    unavailable: copy.loadUnavailable,
    retry: copy.loadRetry,
    reloadReason: copy.reloadReason,
  };
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
