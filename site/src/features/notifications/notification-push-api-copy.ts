import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  invalidEndpointFingerprint: "Invalid Web Push endpoint fingerprint",
  readStateFailed: "Failed to read Web Push state",
  notConfigured: "Web Push is not configured",
  rate: "Too many notification updates. Please try again shortly.",
  identityChanged: "Account or session changed. Reload settings.",
  invalidIdentity: "Invalid Web Push identity",
  invalidSubscription: "Invalid Web Push subscription",
  endpointConflict: "Web Push endpoint is already bound to another session",
  sessionLimit: "Too many Web Push subscriptions for this session",
  registerFailed: "Failed to register Web Push subscription",
  invalidEndpoint: "Invalid Web Push endpoint",
  removeFailed: "Failed to remove Web Push subscription",
};

const ru: Record<keyof typeof en, string> = {
  authenticationRequired: "Требуется вход",
  invalidEndpointFingerprint: "Некорректный отпечаток Web Push endpoint",
  readStateFailed: "Не удалось прочитать состояние Web Push",
  notConfigured: "Web Push не настроен",
  rate: "Слишком много обновлений уведомлений. Попробуйте чуть позже.",
  identityChanged: "Аккаунт или сессия изменились. Обновите настройки.",
  invalidIdentity: "Некорректная идентичность Web Push",
  invalidSubscription: "Некорректная подписка Web Push",
  endpointConflict: "Web Push endpoint уже привязан к другой сессии",
  sessionLimit: "Слишком много Web Push подписок для этой сессии",
  registerFailed: "Не удалось зарегистрировать подписку Web Push",
  invalidEndpoint: "Некорректный Web Push endpoint",
  removeFailed: "Не удалось удалить подписку Web Push",
};

export const notificationPushApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
