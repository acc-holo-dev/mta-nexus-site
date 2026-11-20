import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  fetchFailed: "Failed to fetch notification preferences",
  rate: "Too many preference updates. Please try again shortly.",
  invalidPreferences: "Invalid notification preferences",
  accountChanged: "Account changed. Reload settings.",
  updateFailed: "Failed to update notification preferences",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  fetchFailed: "Не удалось загрузить настройки уведомлений",
  rate: "Слишком много обновлений настроек. Попробуйте чуть позже.",
  invalidPreferences: "Некорректные настройки уведомлений",
  accountChanged: "Аккаунт изменился. Обновите настройки.",
  updateFailed: "Не удалось обновить настройки уведомлений",
};

export const notificationPreferencesApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
