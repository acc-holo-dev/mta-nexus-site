import type { Locale } from "../i18n";

const en = {
  originNotAllowed: "Request origin is not allowed",
  configurationUnavailable: "Request security configuration unavailable",
};

const ru: Record<keyof typeof en, string> = {
  originNotAllowed: "Источник запроса не разрешён",
  configurationUnavailable: "Конфигурация безопасности запроса недоступна",
};

export const browserRequestApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
