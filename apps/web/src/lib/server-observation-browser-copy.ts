import type { Locale } from "./i18n";
import { serverStatisticsError } from "./server-statistics-copy";
const en = {
  title: "Observation browser",
  description:
    "Search stored observations from the official MTA master list within a selected period.",
  open: "Search and filter observations",
  search: "Game mode, map or MTA version",
  players: "Recorded player count",
  all: "All values",
  known: "Known",
  unknown: "Unknown",
  zero: "Zero players",
  password: "Password required",
  responding: "Responding",
  yes: "Yes",
  no: "No",
  apply: "Apply filters",
  reset: "Clear filters",
  empty: "No observations match these filters in this period.",
  scope:
    "Each page contains up to 25 stored observations, newest first. Unknown values and missing records do not establish that a server was offline.",
  export: "Download this filtered page as CSV",
  exportScope:
    "The download rechecks current access and the same period and filters. Later stored records may change the page.",
  latest: "Newest matching observations",
  older: "Older observations",
  newer: "Newer observations",
  statistics: "Compare period statistics",
  invalid:
    "Invalid filters or continuation. Reload matching observations without the continuation.",
  signIn: "Sign in to view managed observations",
  loading: "Loading saved observations…",
  unavailable: "Saved observations could not be loaded. Retry the selected period.",
};
const ru: Record<keyof typeof en, string> = {
  title: "Поиск по наблюдениям",
  description: "Ищите сохранённые наблюдения официального списка MTA за выбранный период.",
  open: "Поиск и фильтры наблюдений",
  search: "Игровой режим, карта или версия MTA",
  players: "Сохранённое число игроков",
  all: "Все значения",
  known: "Известно",
  unknown: "Неизвестно",
  zero: "Ноль игроков",
  password: "Нужен пароль",
  responding: "Отвечает",
  yes: "Да",
  no: "Нет",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  empty: "В этом периоде нет наблюдений с выбранными фильтрами.",
  scope:
    "До 25 сохранённых наблюдений на странице, сначала новые. Неизвестные значения и отсутствие записей не доказывают, что сервер был отключён.",
  export: "Скачать эту страницу с фильтрами в CSV",
  exportScope:
    "Выгрузка проверяет текущий доступ и сохраняет период и фильтры. Позже сохранённые записи могут изменить страницу.",
  latest: "Новые наблюдения с этими фильтрами",
  older: "Более ранние наблюдения",
  newer: "Более новые наблюдения",
  statistics: "Сравнить статистику периода",
  invalid: "Некорректные фильтры или продолжение. Загрузите подходящие наблюдения без продолжения.",
  signIn: "Войдите, чтобы открыть наблюдения управляемого сервера",
  loading: "Загрузка сохранённых наблюдений…",
  unavailable: "Не удалось загрузить сохранённые наблюдения. Повторите выбранный период.",
};
export const serverObservationBrowserCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function serverObservationBrowserError(locale: Locale, code: unknown) {
  if (code === "INVALID_CURSOR" || code === "VALIDATION_ERROR")
    return serverObservationBrowserCopy(locale).invalid;
  if (code === "INTERNAL_ERROR") return serverObservationBrowserCopy(locale).unavailable;
  return serverStatisticsError(locale, code);
}
