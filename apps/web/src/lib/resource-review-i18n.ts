import type { Locale } from "./i18n";
const en = {
  title: "Resource reviews",
  own: "My reviews",
  write: "Write or manage my review",
  reports: "My review reports",
  queue: "Review report queue",
  subtitle:
    "Reviews reflect acquired access, including free resources and legacy licenses. This does not confirm payment, install, or gameplay.",
  published: "Published",
  withdrawn: "Withdrawn",
  removed: "Removed by moderation",
  entitlement: "Library access checked (not verified use)",
  license: "License access checked (not verified use)",
  legacy: "Historical review; acquisition not reverified",
  rating: "Rating",
  text: "Your review",
  save: "Publish review",
  withdraw: "Withdraw review",
  busy: "Saving…",
  saved: "Saved",
  unavailable: "Resource unavailable",
  empty: "No reviews yet.",
  access:
    "Current library access and a safe published version are required to publish. Access is not proof of install or gameplay. Publishers and managers cannot review their own resources.",
  ownerConflict:
    "Authors, organization managers and staff cannot publish a review for this resource.",
  accessRequired: "Add this resource to your library before publishing a review.",
  resourceUnavailable: "A published safe version is required before a review can be published.",
  moderatedEligibility: "This review was removed by moderation and cannot be republished.",
  reason: "Reason",
  notes: "Moderation reason (shown to the review author when removing)",
  report: "Report review",
  send: "Submit report",
  reportSaved: "Report submitted",
  reportEmpty: "No reports in this view.",
  spam: "Spam",
  abuse: "Abuse",
  copyright: "Copyright",
  other: "Other",
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
  pending: "Pending",
  history: "History",
  review: "Mark under review",
  resolve: "Resolve",
  dismiss: "Dismiss",
  remove_review: "Remove review and resolve",
  decide: "Save decision",
  back: "Back",
  previous: "Previous",
  next: "Next",
  signIn: "Sign in",
  reload: "Reload saved state",
  unknown: "The result could not be confirmed. Reload the saved state before continuing.",
  failure: "Unable to save. Please try again.",
  changed: "The review or report changed. Reload before trying again.",
  denied: "You no longer have permission or acquired access.",
  invalid: "Check the rating and text length.",
  limited: "Too many requests. Try again later.",
  moderator: "This review was removed by moderation and cannot be republished.",
  missing: "The resource or review is unavailable.",
  author: "Author",
  all: "All reviews",
  detail: "Open report",
};
const ru: typeof en = {
  title: "Отзывы о ресурсах",
  own: "Мои отзывы",
  write: "Написать или изменить мой отзыв",
  reports: "Мои жалобы на отзывы",
  queue: "Жалобы на отзывы ресурсов",
  subtitle:
    "Отзывы опираются на доступ к ресурсу, включая бесплатные ресурсы и старые лицензии. Это не подтверждение оплаты, установки или игровой сессии.",
  published: "Опубликован",
  withdrawn: "Отозван",
  removed: "Удалён модерацией",
  entitlement: "Доступ в библиотеке проверен (не подтверждённое использование)",
  license: "Доступ по лицензии проверен (не подтверждённое использование)",
  legacy: "Исторический отзыв; получение не перепроверено",
  rating: "Оценка",
  text: "Ваш отзыв",
  save: "Опубликовать отзыв",
  withdraw: "Отозвать отзыв",
  busy: "Сохранение…",
  saved: "Сохранено",
  unavailable: "Ресурс недоступен",
  empty: "Отзывов пока нет.",
  access:
    "Для публикации нужен действующий доступ в библиотеке и безопасная опубликованная версия. Доступ не доказывает установку или игру. Издатели и управляющие не могут оценивать свои ресурсы.",
  ownerConflict:
    "Авторы, управляющие организацией и сотрудники не могут публиковать отзыв об этом ресурсе.",
  accessRequired: "Сначала добавьте ресурс в библиотеку, затем публикуйте отзыв.",
  resourceUnavailable: "Для публикации отзыва нужна опубликованная безопасная версия.",
  moderatedEligibility: "Отзыв удалён модерацией; повторная публикация недоступна.",
  reason: "Причина",
  notes: "Причина решения (при удалении видна автору отзыва)",
  report: "Пожаловаться на отзыв",
  send: "Отправить жалобу",
  reportSaved: "Жалоба отправлена",
  reportEmpty: "Жалоб в этом разделе нет.",
  spam: "Спам",
  abuse: "Оскорбления",
  copyright: "Авторские права",
  other: "Другое",
  open: "Открыта",
  under_review: "На рассмотрении",
  resolved: "Решена",
  dismissed: "Отклонена",
  pending: "Текущие",
  history: "История",
  review: "Взять на рассмотрение",
  resolve: "Решить",
  dismiss: "Отклонить",
  remove_review: "Удалить отзыв и решить жалобу",
  decide: "Сохранить решение",
  back: "Назад",
  previous: "Назад",
  next: "Далее",
  signIn: "Войти",
  reload: "Обновить сохранённое состояние",
  unknown: "Результат не подтверждён. Обновите сохранённое состояние перед продолжением.",
  failure: "Не удалось сохранить. Попробуйте ещё раз.",
  changed: "Отзыв или жалоба изменились. Обновите страницу перед повтором.",
  denied: "Полномочия или доступ к ресурсу больше не действуют.",
  invalid: "Проверьте оценку и длину текста.",
  limited: "Слишком много запросов. Повторите позже.",
  moderator: "Отзыв удалён модерацией; повторная публикация недоступна.",
  missing: "Ресурс или отзыв недоступен.",
  author: "Автор",
  all: "Все отзывы",
  detail: "Открыть жалобу",
};
export const resourceReviewCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function resourceReviewError(locale: Locale, code: unknown) {
  const copy = resourceReviewCopy(locale);
  if (["REVIEW_CHANGED", "REVIEW_REPORT_CHANGED"].includes(String(code))) return copy.changed;
  if (["FORBIDDEN", "REVIEW_ACCESS_REQUIRED", "REVIEW_SELF_MODERATION"].includes(String(code)))
    return copy.denied;
  if (code === "REVIEW_MODERATED") return copy.moderator;
  if (code === "NOT_FOUND") return copy.missing;
  if (["REVIEW_INVALID", "REVIEW_REPORT_INVALID", "REPORT_OWN_TARGET"].includes(String(code)))
    return copy.invalid;
  if (code === "RATE_LIMIT_EXCEEDED") return copy.limited;
  return copy.failure;
}
export function resourceReviewState(locale: Locale, state: string) {
  const copy = resourceReviewCopy(locale);
  return state === "published" ||
    state === "withdrawn" ||
    state === "removed" ||
    state === "open" ||
    state === "under_review" ||
    state === "resolved" ||
    state === "dismissed"
    ? copy[state]
    : copy.unavailable;
}
export type ResourceReviewEligibilityReason =
  | "ok"
  | "owner_conflict"
  | "access_required"
  | "resource_unavailable"
  | "moderated";
export function resourceReviewEligibilityCopy(
  locale: Locale,
  reason: ResourceReviewEligibilityReason | string | null | undefined,
) {
  const copy = resourceReviewCopy(locale);
  if (reason === "owner_conflict") return copy.ownerConflict;
  if (reason === "access_required") return copy.accessRequired;
  if (reason === "resource_unavailable") return copy.resourceUnavailable;
  if (reason === "moderated") return copy.moderatedEligibility;
  return null;
}
