import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  listUnavailable: "Account settings are temporarily unavailable.",
  rate: "Too many session security requests. Please try again shortly.",
  invalidAction: "Provide exactly one session revocation action",
  accountChanged: "Account changed. Reload settings and try again.",
  currentSessionBlocked: "The current session cannot be revoked here; use logout instead",
  sessionNotFound: "Session not found or not owned by you",
  updateUnavailable: "Could not confirm the session update. Reload settings before retrying.",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  listUnavailable: "Настройки аккаунта временно недоступны.",
  rate: "Слишком много запросов к сессиям. Попробуйте чуть позже.",
  invalidAction: "Укажите ровно одно действие отзыва сессии",
  accountChanged: "Аккаунт изменился. Обновите настройки и попробуйте снова.",
  currentSessionBlocked: "Текущую сессию здесь отозвать нельзя; используйте выход",
  sessionNotFound: "Сессия не найдена или вам не принадлежит",
  updateUnavailable:
    "Не удалось подтвердить обновление сессий. Обновите настройки и повторите попытку.",
};

export const authSessionsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
