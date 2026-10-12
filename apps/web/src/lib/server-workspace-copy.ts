import type { Locale } from "./i18n";
import { userPlatformError } from "./user-platform-copy";

const en = {
  batchTitle: "Change visibility together",
  batchHelp: "Select up to 20 servers on this page. Review their current visibility before saving.",
  select: "Select server",
  selected: "Selected",
  selectAll: "Select page",
  clear: "Clear selection",
  preview: "Review selection",
  previewTitle: "Confirm server visibility",
  confirm: "Save reviewed visibility",
  cancel: "Cancel",
  busy: "Checking and saving…",
  saved: "The reviewed visibility has been saved.",
  noChanges: "Every selected server already has this visibility.",
  reload: "Reload this page",
  transition: "Visibility change",
  notes:
    "Listing status, ownership, control proofs and MTA observations keep their current values.",
  publicHelp: "Public servers can appear in discovery and the public catalog.",
  unlistedHelp: "Unlisted servers can be opened by direct link and are excluded from discovery.",
  privateHelp: "Private server pages are available to their current managers.",
  forbidden: "You no longer have server management permission.",
  missing: "The server was not found or is unavailable to your account.",
  empty: "Select at least one server.",
  invalid: "Check the selection and visibility.",
  changed: "Server details or management rights changed. Reload and review the selection again.",
  unavailable: "Server management is temporarily unavailable.",
  uncertain: "The save result could not be confirmed. Reload before making another change.",
  period: "Period",
  all: "All time",
  days7: "7 days",
  days30: "30 days",
  days90: "90 days",
  days365: "365 days",
  action: "Event group",
  actionAll: "All recorded events",
  listing: "Listing edits",
  visibility: "Visibility edits",
  control: "Control proofs",
  verification: "Verification decisions",
  apply: "Apply filters",
  reset: "Reset filters",
  historyInvalid: "The history filters or page link are invalid. Reset the filters.",
  export: "Export this page as JSON",
  exportHelp: "Exports up to 20 recorded events with the same filters and current permissions.",
  historyUnavailable: "Server history is temporarily unavailable.",
  moderation: "Platform moderation",
  team: "Server team",
  identity: "Public account",
  historyEmpty: "No recorded events match these filters.",
};
const ru: typeof en = {
  batchTitle: "Изменить видимость вместе",
  batchHelp:
    "Выберите до 20 серверов на этой странице. Перед сохранением проверьте их текущую видимость.",
  select: "Выбрать сервер",
  selected: "Выбрано",
  selectAll: "Выбрать страницу",
  clear: "Снять выбор",
  preview: "Проверить выбор",
  previewTitle: "Подтвердите видимость серверов",
  confirm: "Сохранить проверенную видимость",
  cancel: "Отмена",
  busy: "Проверяем и сохраняем…",
  saved: "Проверенная видимость сохранена.",
  noChanges: "Все выбранные серверы уже имеют эту видимость.",
  reload: "Перезагрузить страницу",
  transition: "Изменение видимости",
  notes:
    "Статус карточки, владение, подтверждения контроля и наблюдения MTA сохраняют текущие значения.",
  publicHelp: "Публичные серверы могут появляться в поиске и общем каталоге.",
  unlistedHelp: "Серверы по ссылке доступны по прямому адресу и исключены из поиска.",
  privateHelp: "Приватные страницы серверов доступны их текущим управляющим.",
  forbidden: "У вас больше нет прав управления сервером.",
  missing: "Сервер не найден или недоступен вашему аккаунту.",
  empty: "Выберите хотя бы один сервер.",
  invalid: "Проверьте выбор серверов и видимость.",
  changed:
    "Данные сервера или права управления изменились. Перезагрузите страницу и проверьте выбор заново.",
  unavailable: "Управление серверами временно недоступно.",
  uncertain:
    "Результат сохранения не подтверждён. Перезагрузите страницу перед следующим изменением.",
  period: "Период",
  all: "За всё время",
  days7: "7 дней",
  days30: "30 дней",
  days90: "90 дней",
  days365: "365 дней",
  action: "Группа событий",
  actionAll: "Все сохранённые события",
  listing: "Правки карточки",
  visibility: "Правки видимости",
  control: "Подтверждения контроля",
  verification: "Решения по верификации",
  apply: "Применить фильтры",
  reset: "Сбросить фильтры",
  historyInvalid: "Фильтры истории или ссылка на страницу некорректны. Сбросьте фильтры.",
  export: "Экспорт страницы в JSON",
  exportHelp: "Экспортирует до 20 сохранённых событий с теми же фильтрами и текущими правами.",
  historyUnavailable: "История сервера временно недоступна.",
  moderation: "Модерация платформы",
  team: "Команда сервера",
  identity: "Публичный аккаунт",
  historyEmpty: "С выбранными фильтрами сохранённых событий нет.",
};
export function serverWorkspaceCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}
export function serverWorkspaceError(locale: Locale, code: unknown) {
  const copy = serverWorkspaceCopy(locale);
  if (code === "FORBIDDEN") return copy.forbidden;
  if (code === "NOT_FOUND") return copy.missing;
  if (["SERVER_BATCH_CHANGED", "SERVER_METADATA_CONFLICT"].includes(String(code)))
    return copy.changed;
  if (code === "SERVER_BATCH_INVALID") return copy.invalid;
  if (["INVALID_CURSOR", "SERVER_HISTORY_FILTER_INVALID"].includes(String(code)))
    return copy.historyInvalid;
  return userPlatformError(locale, code);
}
