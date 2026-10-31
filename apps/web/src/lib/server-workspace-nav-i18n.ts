import type { Locale } from "./i18n";

const copy = {
  en: {
    navigation: "Server workspace sections",
    overview: "Overview",
    content: "Publications",
    activity: "Activity",
    statistics: "Statistics",
    observations: "Observations",
  },
  ru: {
    navigation: "Разделы кабинета сервера",
    overview: "Обзор",
    content: "Публикации",
    activity: "История",
    statistics: "Статистика",
    observations: "Наблюдения",
  },
} as const;

export function getServerWorkspaceNavCopy(locale: Locale) {
  return copy[locale];
}
