import type { Locale } from "../../lib/i18n";

const en = {
  invalidQuery: "Invalid directory query",
  unavailable: "The official MTA server directory is temporarily unavailable",
};

const ru: Record<keyof typeof en, string> = {
  invalidQuery: "Некорректный запрос каталога",
  unavailable: "Официальный каталог серверов MTA временно недоступен",
};

export const serversDirectoryApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
