import type { Locale } from "../../lib/i18n";

const en = {
  unauthorized: "Unauthorized",
  invalidPage: "Invalid page",
  listFailed: "Failed to load platform reports",
  notFound: "Not found",
  detailFailed: "Failed to load platform report",
};

const ru: Record<keyof typeof en, string> = {
  unauthorized: "Нет доступа",
  invalidPage: "Некорректная страница",
  listFailed: "Не удалось загрузить platform-отчёты",
  notFound: "Не найдено",
  detailFailed: "Не удалось загрузить platform-отчёт",
};

export const platformReportsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
