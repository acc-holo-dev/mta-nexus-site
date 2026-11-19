import type { Locale } from "../../lib/i18n";

const en = {
  notFound: "Article not found",
  unavailable: "Article is temporarily unavailable",
};

const ru: Record<keyof typeof en, string> = {
  notFound: "Статья не найдена",
  unavailable: "Статья временно недоступна",
};

export const contentApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
