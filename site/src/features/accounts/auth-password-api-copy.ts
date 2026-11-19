import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  rate: "Too many password change attempts. Please try again later.",
  validationFailed: "Password change validation failed",
  accountChanged: "Account changed. Reload settings and try again.",
  freshAuthRequired: "Confirm your current password and try again.",
  unauthorized: "Current password is incorrect",
  unavailable: "Could not confirm the password change. Sign in again before retrying.",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  rate: "Слишком много попыток смены пароля. Попробуйте позже.",
  validationFailed: "Не удалось проверить смену пароля",
  accountChanged: "Аккаунт изменился. Обновите настройки и попробуйте снова.",
  freshAuthRequired: "Подтвердите текущий пароль и попробуйте снова.",
  unauthorized: "Текущий пароль неверен",
  unavailable: "Не удалось подтвердить смену пароля. Войдите снова и повторите попытку.",
};

export const authPasswordApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
