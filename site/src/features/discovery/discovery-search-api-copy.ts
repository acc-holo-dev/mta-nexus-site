import type { Locale } from "../../lib/i18n";

const en = {
  queryTooLong: (max: number) => `Search query must be at most ${max} characters`,
  unknownType: "Unknown search type",
  rate: "Search rate limit exceeded. Please try again shortly.",
  unavailable: "Search is temporarily unavailable",
};

const ru = {
  queryTooLong: (max: number) => `Поисковый запрос не длиннее ${max} символов`,
  unknownType: "Неизвестный тип поиска",
  rate: "Превышен лимит поиска. Попробуйте чуть позже.",
  unavailable: "Поиск временно недоступен",
};

export const discoverySearchApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
