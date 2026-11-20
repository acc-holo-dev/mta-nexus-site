import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  statusUnavailable: "Could not check recovery email status",
  validationFailed: "Email verification validation failed",
  accountChanged: "Account changed. Reload settings.",
  startFailed: "Could not start email verification. Please try again later.",
  invalidOrExpired: "Invalid or expired email confirmation",
  confirmFailed: "Could not confirm this email. Please try again later.",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  statusUnavailable: "Не удалось проверить статус recovery-email.",
  validationFailed: "Проверка данных для подтверждения email не пройдена",
  accountChanged: "Аккаунт изменился. Обновите настройки.",
  startFailed: "Не удалось начать подтверждение email. Попробуйте позже.",
  invalidOrExpired: "Недействительное или просроченное подтверждение email",
  confirmFailed: "Не удалось подтвердить этот email. Попробуйте позже.",
};

export const authEmailVerificationApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
