import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  listUnavailable: "Account contexts are temporarily unavailable.",
  rate: "Too many context switches. Please try again shortly.",
  invalidContext: "Invalid context",
  accountChanged: "Account changed. Reload contexts.",
  switchFailed: "Failed to switch context",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  listUnavailable: "Контексты аккаунта временно недоступны.",
  rate: "Слишком много переключений контекста. Попробуйте чуть позже.",
  invalidContext: "Некорректный контекст",
  accountChanged: "Аккаунт изменился. Обновите список контекстов.",
  switchFailed: "Не удалось переключить контекст",
};

export const authContextApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
