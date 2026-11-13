import type { Locale } from "./i18n";
export function formatSubscriptionTime(value: Date, locale: Locale) {
  return `${new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value)} UTC`;
}
