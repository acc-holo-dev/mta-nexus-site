import type { Locale } from "./i18n";
const en = {
  title: "Server statistics",
  open: "Detailed statistics",
  back: "Back to server",
  management: "Back to server management",
  description: "Explore saved MTA master-list observations and compare consecutive periods.",
  scope:
    "Counts and averages describe recorded observations. Averages are per observation, not weighted by duration; gaps are unknown and never represent downtime.",
  lifetime:
    "History follows this listing across address changes. Earlier observations cannot be assigned to a specific endpoint revision.",
  private: "Available to current server managers and platform administrators.",
  paused:
    "This listing is currently excluded from collection. Previously stored observations may remain available.",
  current: "Selected period",
  previous: "Previous equal-length period",
  comparison: "Period comparison",
  samples: "Observations",
  known: "With player counts",
  peak: "Peak players",
  average: "Average players",
  change: "Change in observed average",
  unknown: "Unknown",
  yes: "Yes",
  no: "No",
  empty:
    "No stored observations in this period. Choose another period or check that the existing collector is running.",
  observations: "Recorded observations",
  observationsScope:
    "Newest first, 25 per page. Period totals and chart include all matching records.",
  time: "Observed at (UTC)",
  players: "Players",
  capacity: "Capacity",
  mode: "Game mode",
  map: "Map",
  version: "MTA version",
  password: "Password required",
  responding: "Responding",
  earlier: "Earlier observations",
  latest: "Newest observations in this period",
  refresh: "Refresh period",
  windows: "Observation period",
  period24h: "24 hours",
  period7d: "7 days",
  period30d: "30 days",
  chart: "Observed player peaks by interval",
  chartScope:
    "Missing intervals have no player value. The table preserves zero-player observations.",
  export: "Download interval CSV",
  exportSamples: "Download this observation page as CSV",
  downloading: "Preparing download…",
  endOfPage: "No earlier recorded observations in this period.",
  exportScope:
    "Interval CSV includes the entire selected period, including empty intervals. Observation CSV contains only the displayed page. Exports retain the displayed period end.",
  snapshot: "Period end",
  snapshotScope:
    "Period boundaries stay fixed across pages. Later saved observations may change the results.",
  unavailable: "Statistics are temporarily unavailable. Retry this period.",
  retry: "Retry",
  invalid: "Invalid period or page link. Open the latest period to continue.",
  expired: "This observation page is no longer available. Return to the newest observations.",
  signIn: "Sign in to view statistics",
  signInAction: "Sign in",
  navigation: "Observation pages",
  notFound: "Server not found",
  limit: "Too many statistics requests. Try again shortly.",
  forbidden: "You no longer have access to this server.",
};
const ru: typeof en = {
  title: "Статистика сервера",
  open: "Подробная статистика",
  back: "Назад к серверу",
  management: "Назад к управлению сервером",
  description:
    "Просматривайте сохранённые наблюдения MTA master-list и сравнивайте соседние периоды.",
  scope:
    "Количество и средние значения относятся к сохранённым наблюдениям. Среднее рассчитано по наблюдениям, без взвешивания по времени; пропуски неизвестны и не означают простой.",
  lifetime:
    "История сохраняется за карточкой при смене адреса. Более ранние наблюдения нельзя отнести к определённой версии адреса.",
  private: "Доступно текущим управляющим сервера и администраторам платформы.",
  paused:
    "Сейчас эта карточка исключена из сбора данных. Ранее сохранённые наблюдения могут оставаться доступными.",
  current: "Выбранный период",
  previous: "Предыдущий период той же длины",
  comparison: "Сравнение периодов",
  samples: "Наблюдения",
  known: "С числом игроков",
  peak: "Пик игроков",
  average: "Среднее число игроков",
  change: "Изменение наблюдаемого среднего",
  unknown: "Неизвестно",
  yes: "Да",
  no: "Нет",
  empty:
    "В этом периоде нет сохранённых наблюдений. Выберите другой период или проверьте работу существующего сборщика.",
  observations: "Сохранённые наблюдения",
  observationsScope:
    "Сначала новые, по 25 на странице. Итоги и график учитывают все записи периода.",
  time: "Время наблюдения (UTC)",
  players: "Игроки",
  capacity: "Вместимость",
  mode: "Игровой режим",
  map: "Карта",
  version: "Версия MTA",
  password: "Нужен пароль",
  responding: "Отвечает",
  earlier: "Более ранние наблюдения",
  latest: "Новые наблюдения этого периода",
  refresh: "Обновить период",
  windows: "Период наблюдений",
  period24h: "24 часа",
  period7d: "7 дней",
  period30d: "30 дней",
  chart: "Наблюдаемые пики игроков по интервалам",
  chartScope:
    "У пропущенных интервалов нет значения числа игроков. Наблюдения с нулём игроков сохраняются в таблице.",
  export: "Скачать CSV интервалов",
  exportSamples: "Скачать эту страницу наблюдений в CSV",
  downloading: "Подготовка загрузки…",
  endOfPage: "В этом периоде больше нет более ранних наблюдений.",
  exportScope:
    "CSV интервалов включает весь выбранный период, в том числе пустые интервалы. CSV наблюдений содержит только показанную страницу. Выгрузки сохраняют отображаемый конец периода.",
  snapshot: "Конец периода",
  snapshotScope:
    "Границы периода сохраняются при переходе между страницами. Позже сохранённые наблюдения могут изменить результат.",
  unavailable: "Статистика временно недоступна. Повторите загрузку этого периода.",
  retry: "Повторить",
  invalid: "Некорректная ссылка на период или страницу. Откройте последний период для продолжения.",
  expired: "Эта страница наблюдений больше недоступна. Вернитесь к новым наблюдениям.",
  signIn: "Войдите, чтобы открыть статистику",
  signInAction: "Войти",
  navigation: "Страницы наблюдений",
  notFound: "Сервер не найден",
  limit: "Слишком много запросов статистики. Повторите позже.",
  forbidden: "У вас больше нет доступа к этому серверу.",
};
export const serverStatisticsCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function serverStatisticsError(locale: Locale, code: unknown) {
  const copy = serverStatisticsCopy(locale);
  if (code === "UNAUTHORIZED") return copy.signIn;
  if (code === "NOT_FOUND") return copy.notFound;
  if (code === "FORBIDDEN") return copy.forbidden;
  if (code === "RATE_LIMITED") return copy.limit;
  if (code === "VALIDATION_ERROR") return copy.invalid;
  if (code === "SERVER_OBSERVATION_PAGE_EXPIRED") return copy.expired;
  return copy.unavailable;
}
