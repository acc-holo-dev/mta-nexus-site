import type { Locale } from "../../lib/i18n";

const en = {
  checkUnavailable: "Could not check session",
  invalidSignOut: "Invalid sign out request",
  accountChanged: "Account changed. Reload and try again.",
  signOutUnavailable: "Could not confirm sign out. Please try again.",
};

const ru: Record<keyof typeof en, string> = {
  checkUnavailable: "Не удалось проверить сессию",
  invalidSignOut: "Некорректный запрос выхода",
  accountChanged: "Аккаунт изменился. Обновите страницу и попробуйте снова.",
  signOutUnavailable: "Не удалось подтвердить выход. Попробуйте ещё раз.",
};

export const authSessionApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
