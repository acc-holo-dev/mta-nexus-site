import type { Locale } from "../../lib/i18n";

const en = {
  fetchFailed: "Failed to fetch notifications",
};

const ru: Record<keyof typeof en, string> = {
  fetchFailed: "Не удалось загрузить уведомления",
};

export const notificationsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
