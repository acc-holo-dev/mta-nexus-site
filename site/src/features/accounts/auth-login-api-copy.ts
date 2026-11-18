import type { Locale } from "../../lib/i18n";

const en = {
  rate: "Too many login attempts. Please try again in a few minutes.",
  invalidCredentials: "Invalid login credentials",
  failed: "Failed to log in",
};

const ru: Record<keyof typeof en, string> = {
  rate: "Слишком много попыток входа. Попробуйте через несколько минут.",
  invalidCredentials: "Неверные данные для входа",
  failed: "Не удалось войти",
};

export const authLoginApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
