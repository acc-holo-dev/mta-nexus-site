import type { Locale } from "../../lib/i18n";

const en = {
  rate: "Too many registration attempts. Please try again later.",
  validationFailed: "Validation failed",
  failed: "Failed to register",
};

const ru: Record<keyof typeof en, string> = {
  rate: "Слишком много попыток регистрации. Попробуйте позже.",
  validationFailed: "Проверка данных не пройдена",
  failed: "Не удалось зарегистрироваться",
};

export const authRegisterApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
