import type { Locale } from "../../lib/i18n";

const en = {
  invalidEmail: "Enter a valid email address.",
  invalidBody: "Invalid request body",
  requestUnavailable: "Password reset is temporarily unavailable. Please try again later.",
  invalidOrExpired: "Invalid or expired password reset",
  confirmUnavailable: "Could not reset the password. Request a new link and try again.",
};

const ru: Record<keyof typeof en, string> = {
  invalidEmail: "Укажите корректный адрес электронной почты.",
  invalidBody: "Некорректное тело запроса",
  requestUnavailable: "Сброс пароля временно недоступен. Попробуйте позже.",
  invalidOrExpired: "Ссылка сброса пароля недействительна или устарела",
  confirmUnavailable: "Не удалось сбросить пароль. Запросите новую ссылку и попробуйте снова.",
};

export const authPasswordResetApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
