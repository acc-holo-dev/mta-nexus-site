import type { Locale } from "./i18n";
const en = {
  title: "Release notifications",
  watch: "Notify me about new versions",
  unwatch: "Stop release notifications",
  enabled: "Enabled",
  disabled: "Disabled",
  unavailable: "Currently unavailable",
  all: "All",
  library: "Library",
  versions: "Versions",
  signIn: "Sign in",
  signInRequired: "Sign in to manage release notifications",
  note: "Opt in per resource. Only future approved versions are considered. Your current library access and commerce notification preferences are checked before a notice is created. Inbox notices may also use your existing Web Push settings.",
  pinned: "Notifications do not change a saved version or download files automatically.",
  limit: "Up to 100 active resource watches per account.",
  settings: "Notification preferences",
  empty: "No resource watches match this filter.",
  busy: "Saving…",
  saved: "Release preference saved",
  failed: "Could not save the release preference",
  conflict: "The preference changed. Refresh and try again.",
  access: "Current library access is required to enable notifications.",
  maximum: "The limit of 100 active watches has been reached.",
  privateResource: "Resource currently unavailable",
  page: "Page",
  previous: "Previous",
  next: "Next",
  of: "of",
  updated: "Updated",
  invalid: "Invalid watch filters",
  published: "Resource version published",
};
const ru: typeof en = {
  title: "Уведомления о версиях",
  watch: "Сообщать о новых версиях",
  unwatch: "Отключить уведомления о версиях",
  enabled: "Включены",
  disabled: "Отключены",
  unavailable: "Сейчас недоступно",
  all: "Все",
  library: "Библиотека",
  versions: "Версии",
  signIn: "Войти",
  signInRequired: "Войдите для управления уведомлениями о версиях",
  note: "Подписка включается отдельно для каждого ресурса и учитывает будущие одобренные версии. Перед созданием уведомления проверяются действующие права библиотеки и настройки коммерческих уведомлений. Для доставки могут использоваться существующие настройки Web Push.",
  pinned: "Уведомления не меняют закреплённую версию и не скачивают файлы автоматически.",
  limit: "До 100 активных подписок на ресурсы на аккаунт.",
  settings: "Настройки уведомлений",
  empty: "Нет подписок по выбранному фильтру.",
  busy: "Сохранение…",
  saved: "Настройка сохранена",
  failed: "Не удалось сохранить настройку",
  conflict: "Настройка изменилась. Обновите страницу и повторите.",
  access: "Для включения уведомлений нужны действующие права библиотеки.",
  maximum: "Достигнут предел в 100 активных подписок.",
  privateResource: "Ресурс сейчас недоступен",
  page: "Страница",
  previous: "Назад",
  next: "Далее",
  of: "из",
  updated: "Обновлено",
  invalid: "Некорректные фильтры подписок",
  published: "Опубликована версия ресурса",
};
export function resourceReleaseWatchesCopy(locale: Locale) {
  return locale === "ru" ? ru : en;
}
export function resourceReleaseNotification(data: unknown, locale: Locale) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (
    row.kind !== "resource_release" ||
    typeof row.resourceTitle !== "string" ||
    typeof row.version !== "string" ||
    row.resourceTitle.length > 200 ||
    row.version.length > 64
  )
    return null;
  return {
    title: resourceReleaseWatchesCopy(locale).published,
    message: `${row.resourceTitle} · ${row.version}`,
  };
}
