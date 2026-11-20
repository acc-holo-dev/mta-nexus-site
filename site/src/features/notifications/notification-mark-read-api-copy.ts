import type { Locale } from "../../lib/i18n";

const en = {
  unauthorized: "Unauthorized",
  rate: "Too many notification updates. Please try again shortly.",
  invalidTarget: "Invalid notification target",
  accountChanged: "Account changed. Reload notifications.",
  notFound: "Notification not found or not owned by you",
  markFailed: "Failed to mark notifications read",
};

const ru: Record<keyof typeof en, string> = {
  unauthorized: "Нет доступа",
  rate: "Слишком много обновлений уведомлений. Попробуйте чуть позже.",
  invalidTarget: "Некорректная цель уведомления",
  accountChanged: "Аккаунт изменился. Обновите уведомления.",
  notFound: "Уведомление не найдено или вам не принадлежит",
  markFailed: "Не удалось отметить уведомления прочитанными",
};

export const notificationMarkReadApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
