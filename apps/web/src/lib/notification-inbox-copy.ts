import type { Locale } from "./i18n";

const en = {
  markAllRead: "Mark entire inbox as read",
  allConfirm:
    "Mark all currently unread notifications in your entire inbox as read? This also affects messages outside this page and its filters.",
  markOneRead: "Mark as read",
  markOneUnread: "Mark as unread",
  title: "Notification center",
  description: "Search your notification history and manage what you have read.",
  workspace: "Workspace",
  settings: "Notification settings",
  query: "Search stored titles and messages",
  search: "Search",
  reset: "Reset",
  state: "Reading status",
  category: "Category",
  period: "Period",
  period7: "Last 7 days",
  period30: "Last 30 days",
  period90: "Last 90 days",
  period365: "Last 365 days",
  window: "Fixed period (UTC)",
  export: "Export this page as JSON",
  exportHelp:
    "Exports up to 25 saved notifications under these filters, not only the selection. Links and internal delivery data are omitted.",
  exportTooLarge: "This page is too large to export. Narrow your filters and try again.",
  all: "All",
  read: "Read",
  unread: "Unread",
  follow: "Following",
  content: "Community",
  server: "Servers",
  commerce: "Purchases and licenses",
  system: "Account",
  security: "Security",
  latest: "Latest matching notifications",
  older: "Older",
  newer: "Newer",
  view: "View",
  empty: "No notifications yet.",
  emptyFiltered:
    "No matching notifications on this page. Try another filter or return to the latest page.",
  selectPage: "Select this page",
  select: "Select notification",
  selected: "Selected",
  markRead: "Mark selected as read",
  markUnread: "Mark selected as unread",
  saved: "Reading status saved and the inbox refreshed.",
  uncertain:
    "The update could not be confirmed. Reload the saved inbox before making another change.",
  changed: "A selected notification changed. Reload the inbox and select it again.",
  loading: "Refreshing notifications…",
  retry: "Reload saved inbox",
  signIn: "Sign in",
  totalUnread: "Unread across your inbox",
  truncated: "This older notification has been shortened. Open its destination for details.",
  live: "The history updates as notifications arrive or their reading status changes. Selection is limited to this page.",
  invalid: "Invalid notification filters or selection. Start from the latest inbox.",
  unavailable: "The inbox is temporarily unavailable. Try again.",
  unauthorized: "Sign in to view your notifications.",
  forbidden: "This notification update is not allowed.",
  missing: "A selected notification is no longer available.",
  limited: "Too many requests. Try again shortly.",
};
const ru: typeof en = {
  markAllRead: "Отметить весь список прочитанным",
  allConfirm:
    "Отметить все текущие непрочитанные уведомления прочитанными? Это затронет и сообщения вне этой страницы и её фильтров.",
  markOneRead: "Отметить прочитанным",
  markOneUnread: "Отметить непрочитанным",
  title: "Центр уведомлений",
  description: "Ищите сообщения в истории и управляйте прочитанным состоянием.",
  workspace: "Кабинет",
  settings: "Настройки уведомлений",
  query: "Поиск по сохранённым заголовкам и сообщениям",
  search: "Найти",
  reset: "Сбросить",
  state: "Прочитанное состояние",
  category: "Категория",
  period: "Период",
  period7: "За 7 дней",
  period30: "За 30 дней",
  period90: "За 90 дней",
  period365: "За 365 дней",
  window: "Закреплённый период (UTC)",
  export: "Экспорт этой страницы в JSON",
  exportHelp:
    "Экспортирует до 25 сохранённых уведомлений под текущими фильтрами, а не только выбранные. Ссылки и внутренние данные доставки не включаются.",
  exportTooLarge: "Эта страница слишком велика для экспорта. Уточните фильтры и попробуйте снова.",
  all: "Все",
  read: "Прочитанные",
  unread: "Непрочитанные",
  follow: "Подписки",
  content: "Сообщество",
  server: "Серверы",
  commerce: "Покупки и лицензии",
  system: "Аккаунт",
  security: "Безопасность",
  latest: "Последние подходящие уведомления",
  older: "Раньше",
  newer: "Позже",
  view: "Открыть",
  empty: "Уведомлений пока нет.",
  emptyFiltered:
    "На этой странице нет подходящих уведомлений. Измените фильтры или вернитесь к последним сообщениям.",
  selectPage: "Выбрать эту страницу",
  select: "Выбрать уведомление",
  selected: "Выбрано",
  markRead: "Отметить выбранные прочитанными",
  markUnread: "Отметить выбранные непрочитанными",
  saved: "Прочитанное состояние сохранено, список обновлён.",
  uncertain:
    "Обновление не удалось подтвердить. Загрузите сохранённый список перед следующим изменением.",
  changed: "Выбранное уведомление изменилось. Обновите список и выберите его снова.",
  loading: "Обновление уведомлений…",
  retry: "Загрузить сохранённый список",
  signIn: "Войти",
  totalUnread: "Непрочитанных во всём списке",
  truncated: "Старое уведомление сокращено. Откройте его страницу для подробностей.",
  live: "История обновляется при появлении уведомлений и изменении прочитанного состояния. Выбор ограничен текущей страницей.",
  invalid: "Некорректные фильтры или выбор уведомлений. Откройте последние сообщения.",
  unavailable: "Список уведомлений временно недоступен. Попробуйте ещё раз.",
  unauthorized: "Войдите, чтобы просмотреть уведомления.",
  forbidden: "Это изменение уведомлений запрещено.",
  missing: "Одно из выбранных уведомлений больше недоступно.",
  limited: "Слишком много запросов. Попробуйте немного позже.",
};
export const notificationInboxCopy = (locale: Locale) => (locale === "ru" ? ru : en);
export function notificationInboxError(locale: Locale, code: unknown) {
  const copy = notificationInboxCopy(locale);
  switch (code) {
    case "UNAUTHORIZED":
      return copy.unauthorized;
    case "FORBIDDEN":
      return copy.forbidden;
    case "NOT_FOUND":
      return copy.missing;
    case "NOTIFICATION_STATE_CHANGED":
      return copy.changed;
    case "UNSUPPORTED_MEDIA_TYPE":
    case "REQUEST_BODY_TOO_LARGE":
    case "INVALID_BODY_LENGTH":
    case "VALIDATION_ERROR":
    case "INVALID_CURSOR":
      return copy.invalid;
    case "RATE_LIMIT_EXCEEDED":
      return copy.limited;
    case "EXPORT_TOO_LARGE":
      return copy.exportTooLarge;
    default:
      return copy.unavailable;
  }
}
