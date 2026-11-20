import type { Locale } from "../../lib/i18n";

const en = {
  rate: "Too many registration attempts. Please try again later.",
  validationFailed: "Validation failed",
  unauthorized: "Registration is not available for this account",
  conflict: "Account already exists",
  failed: "Failed to register",
};

const ru: Record<keyof typeof en, string> = {
  rate: "Слишком много попыток регистрации. Попробуйте позже.",
  validationFailed: "Проверка данных не пройдена",
  unauthorized: "Регистрация недоступна для этого аккаунта",
  conflict: "Аккаунт уже существует",
  failed: "Не удалось зарегистрироваться",
};

export const authRegisterApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
