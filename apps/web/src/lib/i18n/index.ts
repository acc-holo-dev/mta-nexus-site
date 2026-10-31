import { en } from "./en";
import { ru } from "./ru";

const supportedLocales = ["en", "ru"] as const;
export type Locale = (typeof supportedLocales)[number];

export function resolveLocale(value: string | null | undefined): Locale {
  return value === "ru" ? "ru" : "en";
}

const dictionaries: Record<Locale, typeof en> = { en, ru };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
