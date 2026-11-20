import type { Locale } from "../../lib/i18n";

const en = {
  invalidWindow: "Invalid history window",
  serverNotFound: "Server not found",
  unavailable: "Server history is temporarily unavailable",
};

const ru: Record<keyof typeof en, string> = {
  invalidWindow: "Некорректное окно истории",
  serverNotFound: "Сервер не найден",
  unavailable: "История сервера временно недоступна",
};

export const serverHistoryApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
